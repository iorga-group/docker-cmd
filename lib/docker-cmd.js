'use strict';

var child_process = require('child_process');

/**
 * This is a DockerCmd representing "docker" command line
 * @constructor
 * @param {string} host - Docker host (will be passed to every command with `docker -H=<host>`
 */
function DockerCmd(host) {
    /**
     * Docker host
     * @type string
     */
    this.host = host;
}

/**
 * @callback DockerCmd~callback
 * @param {number} dockerProcessExitCode - the docker process exit code (0 if all was OK)
 */

/**
 * `docker build` command
 * @param {BuildOptions} buildOptions
 * @param {string} target - the target dir or Dockerfile to build
 * @param {DockerCmd~callback} callback
 */
DockerCmd.prototype.build = function(buildOptions, target, callback) {
    this._buildDockerCmdThenSpawn('build', buildOptions, target, callback);
};

/**
 * `docker run` command
 * @param {RunOptions} runOptions
 * @param {string} imageName - The image name to run
 * @param {string[]} argv - The command followed by its args to append after image name
 * @param {DockerCmd~callback} callback
 */
DockerCmd.prototype.run = function(runOptions, imageName, argv, callback) {
    this._buildDockerCmdThenSpawn('run', runOptions, argv ? [imageName].concat(argv) : imageName, callback);
};

/**
 * Append each option from the given <code>fromOptions</code> to the given
 * <code>options</code> array, flattening them to pass them later as parameters to a
 * sub call process.
 * @param {string[]} options
 * @param {BuildOptions|RunOptions} fromOptions
 */
function appendOptions(options, fromOptions) {
    function pushOption(optionName, optionValue) {
        var valueDefined = optionValue !== null && optionValue !== undefined;
        if (optionName.length === 1) {
            // simple letter option
            options.push('-' + optionName);
            if (valueDefined) {
                options.push(optionValue);
            }
        } else {
            // full option name
            options.push('--' + optionName + (valueDefined ? '=' + optionValue : ''));
        }
    }
    for (var optionName in fromOptions) {
        var optionValue = fromOptions[optionName];
        if (Array.isArray(optionValue)) {
            // we have multiple values for the same option, let's iterate on each
            optionValue.forEach(function (iOptionValue) {
                pushOption(optionName, iOptionValue);
            });
        } else {
            pushOption(optionName, optionValue);
        }
    }
}

/**
 * Builds the command line that will be issued to <code>child_process.spawn</code>
 * from the given <code>dockerCommand</code>, <code>options</code> and argv.
 * @param {string} dockerCommand - the docker command name
 * @param {BuildOptions|RunOptions} options - the options to pass to the docker command
 * @param {string|string[]} argv - the args to pass after the options
 * @param {DockerCmd~callback} callback
 */
DockerCmd.prototype._buildDockerCmdThenSpawn = function(dockerCommand, options, argv, callback) {
    // put all options in an array to give to "spawn" later
    var cmdOptions = ['docker'];
    if (this.host) {
        // the host is defined, let's pass it to the docker command
        cmdOptions.push('--host='+this.host);
    }
    cmdOptions.push(dockerCommand);
    appendOptions(cmdOptions, options);
    if (argv) {
        if (Array.isArray(argv)) {
            // it's an array, let's append to the first array
            cmdOptions = cmdOptions.concat(argv);
        } else {
            cmdOptions.push(argv);
        }
    }
    var dockerProcess = child_process.spawn('/usr/bin/env', cmdOptions, {stdio: 'inherit'});
    dockerProcess.on('close', callback);
};

module.exports = DockerCmd;