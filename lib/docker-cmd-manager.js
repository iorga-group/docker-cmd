'use strict';

var DockerCmd = require('./docker-cmd');
var fs = require('fs');
var path = require('path');
var util = require('util');
var extend = require('extend');

/**
 * This class manages the DockerCmd
 * @constructor
 * @param {string} [dockerdescPath='./dockerdesc.json'] - Path to `dockerdesc.json` file or parent dir
 * @param {string} [host] - Docker host (will be passed to every command with `docker -H=<host>`
 */
function DockerCmdManager(dockerdescPath) {
    dockerdescPath = dockerdescPath || './dockerdesc.json';

    if (!fs.existsSync(dockerdescPath)) {
        throw new Error(util.format('The path "%s" does not exists.', dockerdescPath));
    }
    /** @type {string} */
    this.dockerdescDir = path.dirname(dockerdescPath);

    var dockerdescPathStat = fs.statSync(dockerdescPath);
    if (dockerdescPathStat.isDirectory()) {
        this.dockerdescDir = dockerdescPath;
        dockerdescPath = path.join(dockerdescPath, 'dockerdesc.json');
    }
    /** @type {Dockerdesc} */
    this.dockerdesc = JSON.parse(fs.readFileSync(dockerdescPath));
}

DockerCmdManager.prototype.build = _dockerCommandBuilder('build', ['t', 'tag'],
    /** @type {DockerCmdManager~CommandHandler} */ function(commandName, descriptionTarget, descriptionOptions, commandOptions, dockerOptions, finalDescription, dockerdescName, callback) {
        // getting the Dockerfile path and parent dir
        var dockerfilePath = finalDescription.path || (commandOptions._ || [])[0] || descriptionTarget;
        if (path.resolve(dockerfilePath) !== path.normalize(dockerfilePath)) { // checking if absolute path, thanks to http://stackoverflow.com/a/24225816/535203
            // this is not an absolute path let's prepend dockerdesc.json dir
            dockerfilePath = path.join(this.dockerdescDir, dockerfilePath);
        }
        if (!fs.existsSync(dockerfilePath)) {
            throw new Error(util.format('The path "%s" defined for image name "%s" does not exists.', dockerfilePath, descriptionTarget));
        }
        var dockerfileDirPath;
        var dockerfilePathStat = fs.statSync(dockerfilePath);
        if (dockerfilePathStat.isDirectory()) {
            // this path defines actually the directory to the Dockerfile
            dockerfileDirPath = dockerfilePath;
            dockerfilePath = path.join(dockerfilePath, 'Dockerfile');
        } else if (dockerfilePathStat.isFile()) {
            // this path correctly points to the Dockerfile, let's take its parent as dir path
            dockerfileDirPath = path.dirname(dockerfilePath);
        }
        // checking whether to build its parent or not
        if (finalDescription.buildParent) {
            // read the Dockerfile, looking for the "FROM" docker directive & check if this is described in the dockerdesc

            var dockerfileContent = fs.readFileSync(dockerfilePath);
            var fromRe = /^\s*from\s*(\S*)/i;
            var fromMatch = fromRe.exec(dockerfileContent);
            if (fromMatch) {
                var parentImageName = fromMatch[1];
                // looking for that name in descriptions
                var parentBuildDescription = this._lookupDescription('build', parentImageName, ['t', 'tag']).description;

                if (parentBuildDescription) {
                    // found the build description, let's build it
                    console.log(util.format('Found "%s" as a valid parent image to build before building "".', parentImageName, descriptionTarget));
                    var self = this;
                    this.build(parentImageName, descriptionOptions, commandOptions, dockerOptions, function(exitCode) {
                        if (!exitCode) {
                            // Parent image was correctly built, let's build now this image
                            self._computeOptionsThenBuild(dockerfileDirPath, descriptionTarget, descriptionOptions, commandOptions, dockerOptions, finalDescription, dockerdescName, callback);
                        }
                    });
                    return;
                }
            }
        }
        this._computeOptionsThenBuild(dockerfileDirPath, descriptionTarget, descriptionOptions, commandOptions, dockerOptions, finalDescription, dockerdescName, callback);
    });

DockerCmdManager.prototype._computeOptionsThenBuild = function (dockerfilePath, descriptionTarget, descriptionOptions, commandOptions, dockerOptions, finalDescription, dockerdescName, callback) {
    // now compute all the build options
    /** @type {BuildOptions} */
    var buildOptions = finalDescription.options || {};
    if (finalDescription.buildTagFromBuildName && typeof buildOptions.tag === 'undefined' && typeof buildOptions.t === 'undefined') {
        // current tag is not defined, and option buildTagFromBuildName is set, let's add the buildName as a tag
        buildOptions.tag = descriptionTarget;
    }
    // set the argument for docker build to be the path to the Dockerfile
    buildOptions._ = [dockerfilePath];
    // replace it in the finalDescription because it is this parameter that is used by _defaultCommandHandler
    finalDescription.options = buildOptions;
    console.log('Building "'+descriptionTarget+'"');
    _defaultCommandHandler('build', descriptionTarget, descriptionOptions, commandOptions, dockerOptions, finalDescription, dockerdescName, callback);
};

DockerCmdManager.prototype.run = _dockerCommandBuilder('run', ['name'],
    /** @type {DockerCmdManager~CommandHandler} */ function(commandName, descriptionTarget, descriptionOptions, commandOptions, dockerOptions, finalDescription, dockerdescName, callback) {
        var runOptions = finalDescription.options || {};
        runOptions._ = runOptions._ || [];

        if (finalDescription.useRunName && typeof runOptions.name === 'undefined') {
            runOptions.name = descriptionTarget;
        }
        if (runOptions._.length < 1) {
            runOptions._[0] = finalDescription.image || descriptionTarget;
        }
        if (finalDescription.command && runOptions._.length === 1) {
            runOptions._.concat(finalDescription.command);
        }
        // replace it in the finalDescription because it is this parameter that is used by _defaultCommandHandler
        finalDescription.options = runOptions;
        // TODO handle dependencies between containers, and check if the image exists before running it
        _defaultCommandHandler(commandName, descriptionTarget, descriptionOptions, commandOptions, dockerOptions, finalDescription, dockerdescName, callback);
    });


DockerCmdManager.prototype._defaultDescriptions = {
    run: {
        useRunName: true
    },
    build: {
        buildTagFromBuildName: true,
        buildParent: true
    }
};

/**
 * @param {string} commandName - Docker command name
 * @param {string} descriptionTarget
 * @param {string[]} commandOptionsMappingToAName - command options name which refers to a potential descriptionTarget
 * @return {{dockerdescName: string, description: Description}}
 * @private
 */
DockerCmdManager.prototype._lookupDescription = function(commandName, descriptionTarget, commandOptionsMappingToAName) {
    // First, look directly at the descriptions in the dockerdesc
    var dockerdescForThatCommand = this.dockerdesc[commandName] || {};
    var description = dockerdescForThatCommand[descriptionTarget];
    var dockerdescName = descriptionTarget;
    // If not found, try to search for that description with its name field
    if (!description && commandOptionsMappingToAName) {
        for (dockerdescName in dockerdescForThatCommand) {
            /** @type {Description} */
            var iDescription = dockerdescForThatCommand[dockerdescName];
            var optionNameValue = null;
            commandOptionsMappingToAName.forEach(function(optionName) {
                optionNameValue = optionNameValue || (iDescription.options && iDescription.options[optionName]);
            });
            if (optionNameValue === descriptionTarget) {
                // we have a match
                description = iDescription;
                break;
            }
        }
    }
    return {
        dockerdescName: dockerdescName,
        description: description
    };
};

/**
 * @callback DockerCmdManager~CommandHandler
 * @param {string} commandName - Docker command name
 * @param {string} descriptionTarget
 * @param {Object} descriptionOptions - Original description options overrides
 * @param {Options} commandOptions - Original command options
 * @param {Object} dockerOptions - Original docker options
 * @param {Description} finalDescription - Found and enriched description
 * @param {string} dockerdescName - Name of the found description
 * @param {DockerCmd~callback} callback
 */

/**
 * @param {string} commandName - Docker command name
 * @param {string[]} commandOptionsMappingToAName - command options name which refers to a potential descriptionTarget
 * @param {DockerCmdManager~CommandHandler} commandHandler
 * @private
 */
function _dockerCommandBuilder(commandName, commandOptionsMappingToAName, commandHandler) {
    /**
     *
     * @param {string} descriptionTarget
     * @param {Object} descriptionOptions - overrides from Description
     * @param {Options} commandOptions
     * @param {Object} dockerOptions
     * @param {DockerCmd~callback} callback
     * @private
     */
    return function(descriptionTarget, descriptionOptions, commandOptions, dockerOptions, callback) {
        // the callback is always the last argument
        switch (arguments.length) {
            case 2:
                callback = descriptionOptions;
                descriptionOptions = undefined;
                break;
            case 3:
                callback = commandOptions;
                commandOptions = undefined;
                break;
            case 4:
                callback = dockerOptions;
                dockerOptions = undefined;
        }
        // First, look directly at the descriptions in the dockerdesc
        var lookup = this._lookupDescription(commandName, descriptionTarget, commandOptionsMappingToAName);
        var description = lookup.description;
        var dockerdescName = lookup.dockerdescName;
        // Now will create the final description : beginning from defaults, append the fields from the "default" template, then all the templates from the given
        // <code>description</code>, then the fields of the description, and finally the given commandOptions & dockerOptions
        var finalDescription = extend(true, {}, this._defaultDescriptions[commandName]); // copy defaults
        var templates = (this.dockerdesc.templates || {})[commandName] || {};
        function applyTemplate(template) {
            if (template) {
                extend(true, finalDescription, template);
            }
        }
        // Apply templates beginning with `default`
        applyTemplate(templates.default);
        var descriptionTemplates = description.templates;
        if (descriptionTemplates) {
            [].concat(descriptionTemplates).forEach(function (templateName) {
                var template = templates[templateName];
                if (!template) {
                    throw new Error(util.format('%s template "%s" is missing', commandName, templateName));
                } else {
                    applyTemplate(template);
                }
            });
        }
        // Apply all fields from given description
        applyTemplate(description);
        // And finally, the options passed from the command line
        applyTemplate(descriptionOptions);
        applyTemplate({dockerOptions: dockerOptions, options: commandOptions});

        commandHandler.call(this, commandName, descriptionTarget, descriptionOptions, commandOptions, dockerOptions, finalDescription, dockerdescName, callback);
    }
}

/**
 * @type {DockerCmdManager~CommandHandler}
 * @private
 */
function _defaultCommandHandler(commandName, descriptionTarget, descriptionOptions, commandOptions, dockerOptions, finalDescription, dockerdescName, callback) {
    new DockerCmd().executeCommand(commandName, finalDescription.options, finalDescription.dockerOptions, callback);
}

/**
 * @param {string} commandName - Docker command name
 * @param {string[]} [commandOptionsMappingToAName] - command options name which refers to a potential descriptionTarget
 */
function _defaultDockerCommandBuilder(commandName, commandOptionsMappingToAName) {
    return _dockerCommandBuilder(commandName, commandOptionsMappingToAName, _defaultCommandHandler);
}

/// copy default commands if not already exists
Object.getOwnPropertyNames(DockerCmd.prototype).forEach(function(dockerCmdPropertyName) {
    var dockerCmdProperty = DockerCmd.prototype[dockerCmdPropertyName];
    if (typeof dockerCmdProperty === 'function' && !DockerCmdManager.prototype[dockerCmdPropertyName]) {
        // let's define the not yet defined function linked to corresponding DockerCmd function
        DockerCmdManager.prototype[dockerCmdPropertyName] = _defaultDockerCommandBuilder(dockerCmdPropertyName);
    }
});

module.exports = DockerCmdManager;