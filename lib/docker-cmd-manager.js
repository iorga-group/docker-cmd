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
function DockerCmdManager(dockerdescPath, host) {
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
    /** @type {Object.<string, BuildDescription>} */
    this.buildDescriptionsByTag = {};

    // parsing the dockerdesc in order to extract the BuildOptions by name
    for (var buildName in this.dockerdesc.builds) {
        /** @type {BuildDescription} */
        var buildDescription = this.dockerdesc.builds[buildName];
        var tag = buildDescription.options && (buildDescription.options.tag || buildDescription.options.t);
        if (tag) {
            this.buildDescriptionsByTag[tag] = buildDescription;
        }
    }

    /** @type {Object.<string, RunDescription>} */
    this.runDescriptionsByName = {};
    // parsing the dockerdesc in order to extract the RunOptions by name
    for (var runName in this.dockerdesc.runs) {
        /** @type {RunDescription} */
        var runDescription = this.dockerdesc.runs[runName];
        var name = runDescription.options && runDescription.options.name;
        if (name) {
            this.runDescriptionsByName[name] = runDescription;
        }
    }

    /** @type {string} */
    this.host = host;
}

/**
 * `docker build` command
 * @param {string} imageName - Image name to build
 * @param {DockerCmd~callback} callback
 */
DockerCmdManager.prototype.build = function(imageName, callback) {
    // checking the existence of that image name
    /** @type {BuildDescription} */
    var buildDescription = this._lookupBuildDescriptionForImageName(imageName);
    if (!buildDescription) {
        throw new Error(util.format('Couldn\'t find the build description for image name "%s" in the dockerdesc file.', imageName));
    }
    buildDescription = this._createFinalDescription(buildDescription, 'build');

    // checking whether to build its parent or not
    if (buildDescription.buildParent) {
        // read the Dockerfile, looking for the "FROM" docker directive & check if this is described in the dockerdesc
        // getting the Dockerfile path and parent dir
        var dockerfilePath = buildDescription.path;
        if (path.resolve(dockerfilePath) !== path.normalize(dockerfilePath)) { // checking if absolute path, thanks to http://stackoverflow.com/a/24225816/535203
            // this is not an absolute path let's prepend dockerdesc.json dir
            dockerfilePath = path.join(this.dockerdescDir, dockerfilePath);
        }
        if (!fs.existsSync(dockerfilePath)) {
            throw new Error(util.format('The path "%s" defined for image name "%s" does not exists.', dockerfilePath, imageName));
        }
        //var dockerfileDirPath; // not used
        var dockerfilePathStat = fs.statSync(dockerfilePath);
        if (dockerfilePathStat.isDirectory()) {
            // this path defines actually the directory to the Dockerfile
            //dockerfileDirPath = dockerfilePath; // not used
            dockerfilePath = path.join(dockerfilePath, 'Dockerfile');
        } else if (dockerfilePathStat.isFile()) {
            // this path correctly points to the Dockerfile, let's take its parent as dir path
            //dockerfileDirPath = path.dirname(dockerfilePath); // not used
        }
        var dockerfileContent = fs.readFileSync(dockerfilePath);
        var fromRe = /^\s*from\s*(\S*)/i;
        var fromMatch = fromRe.exec(dockerfileContent);
        if (fromMatch) {
            var parentImageName = fromMatch[1];
            // looking for that name in descriptions
            var parentBuildDescription = this._lookupBuildDescriptionForImageName(parentImageName);
            if (parentBuildDescription) {
                // found the build description, let's build it
                console.log(util.format('Found "%s" as a valid parent image to build before building "".', parentImageName, imageName));
                var self = this;
                this.build(parentImageName, function(exitCode) {
                    if (!exitCode) {
                        // Parent image was correctly build, let's build now this image
                        self._computeOptionsThenBuild(imageName, buildDescription, callback);
                    }
                });
                return;
            }
        }
    }
    this._computeOptionsThenBuild(imageName, buildDescription, callback);
};

/**
 * `docker run` command
 * @param {string} containerName - Container name to run
 * @param {DockerCmd~callback} callback
 */
DockerCmdManager.prototype.run = function(containerName, callback) {
    /** @type {RunDescription} */
    var runDescription = this.dockerdesc.runs[containerName] || this.runDescriptionsByName[containerName];

    if (!runDescription) {
        throw new Error(util.format('Couldn\'t find the run description for container name "%s" in the dockerdesc file.', containerName));
    }

    runDescription = this._createFinalDescription(runDescription, 'run');

    var runOptions = runDescription.options || {};
    if (runDescription.useRunName && typeof runOptions.name === 'undefined') {
        runOptions.name = containerName;
    }

    // TODO handle dependencies between containers, and check if the image exists before running it
    this._dockerCmd(runDescription).run(runOptions, runDescription.image, runDescription.command, callback);
};

/** @type {RunDescription} */
DockerCmdManager.prototype._defaultRunDescription = {
    useRunName: true
};

/** @type {BuildDescription} */
DockerCmdManager.prototype._defaultBuildDescription = {
    buildTagFromBuildName: true,
    buildParent: true
};

/**
 * Beginning from defaults, append the fields from the  default template, then all the templates from the given
 * <code>description</code> and finally the fields of the
 * @param {RunDescription|BuildDescription} description
 * @param {'build'|'run'} descriptionType
 */
DockerCmdManager.prototype._createFinalDescription = function(description, descriptionType) {
    var finalDescription = extend(true, {}, this['_default'+descriptionType.charAt(0).toUpperCase()+descriptionType.slice(1)+'Description']); // copy defaults
    var templates = (this.dockerdesc.templates || {})[descriptionType+'s'] || {};
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
                throw new Error(util.format('%s template "%s" is missing', descriptionType, templateName));
            } else {
                applyTemplate(template);
            }
        });
    }
    // Finally, apply all fields from given description
    applyTemplate(description);
    return finalDescription;
};

/**
 * Finds in the dockerdesc the BuildDescription for the given imageName.
 * @param imageName - Image name to lookup for
 * @returns {BuildDescription}
 * @private
 */
DockerCmdManager.prototype._lookupBuildDescriptionForImageName = function (imageName) {
    return this.dockerdesc.builds[imageName] || this.buildDescriptionsByTag[imageName];
};

/**
 * Creates a DockerCmd using this DockerCmdManager's host or the one in the given <code>description</code>.
 * @param {BuildDescription|RunDescription} description
 * @return {DockerCmd}
 * @private
 */
DockerCmdManager.prototype._dockerCmd = function(description) {
    return new DockerCmd(this.host || description.host);
};

/**
 * @param imageName
 * @param {BuildDescription} buildDescription
 * @param callback
 * @private
 */
DockerCmdManager.prototype._computeOptionsThenBuild = function (imageName, buildDescription, callback) {
    // now compute all the build options
    /** @type {BuildOptions} */
    var buildOptions = buildDescription.options || {};
    if (buildDescription.buildTagFromBuildName && typeof buildOptions.tag === 'undefined' && typeof buildOptions.t === 'undefined') {
        // current tag is not defined, and option buildTagFromBuildName is set, let's add the buildName as a tag
        buildOptions.tag = imageName;
    }
    //TODO add some template system to add options from those defined templates
    console.log('Building "'+imageName+'"');
    this._dockerCmd(buildDescription).build(buildOptions, buildDescription.path, callback);
};

module.exports = DockerCmdManager;