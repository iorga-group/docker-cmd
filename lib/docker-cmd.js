'use strict';

var child_process = require('child_process');

/**
 * This is a DockerCmd representing "docker" command line
 * @constructor
 */
function DockerCmd() {
}

/**
 * @callback DockerCmd~callback
 * @param {number} dockerProcessExitCode - the docker process exit code (0 if all was OK)
 */

/**
 * Execute the given <code>commandName</code> with the given <code>dockerOptions</code> and <code>commandOptions</code>.
 * @param {string} commandName
 * @param {Options} commandOptions
 * @param {Object} dockerOptions
 * @param {DockerCmd~callback} callback
 */
DockerCmd.prototype.executeCommand = function(commandName, commandOptions, dockerOptions, callback) {
    // put all options in an array to give to "spawn" later
    var cmdOptions = ['docker'];

    // first the docker options to pass before the docker command
    appendOptions(cmdOptions, dockerOptions);
    // then the docker command
    cmdOptions.push(commandName);
    // and finally the command options with potentially final args (using the '_' field)
    appendOptions(cmdOptions, commandOptions);

    var dockerProcess = child_process.spawn('/usr/bin/env', cmdOptions, {stdio: 'inherit'});
    dockerProcess.on('close', callback);
};

/**
 * @param {string} commandName
 * @return {function(this:DockerCmd, Options, Object, DockerCmd~callback)}
 * @private
 */
DockerCmd.prototype._createDefaultCommand = function(commandName) {
    var self = this;
    /**
     * @param {Options} commandOptions
     * @param {Object} dockerOptions
     * @param {DockerCmd~callback} callback
     */
    return function(commandOptions, dockerOptions, callback) {
        self.executeCommand(commandName, commandOptions, dockerOptions, callback);
    }
};

/// Declare all the docker commands
[
    'attach',
    'build',
    'commit',
    'cp',
    'diff',
    'events',
    'export',
    'history',
    'images',
    'import',
    'info',
    'inspect',
    'kill',
    'load',
    'login',
    'logout',
    'logs',
    'port',
    'pause',
    'ps',
    'pull',
    'push',
    'restart',
    'rm',
    'run',
    'save',
    'search',
    'start',
    'stop',
    'tag',
    'top',
    'unpause',
    'version',
    'wait'
].forEach(function (commandName) {
        DockerCmd.prototype[commandName] = DockerCmd.prototype._createDefaultCommand(commandName);
    });

/**
 * Append each option from the given <code>fromOptions</code> to the given
 * <code>options</code> array, flattening them to pass them later as parameters to a
 * sub call process.
 * @param {string[]} options
 * @param {Options} fromOptions
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
        if (fromOptions.hasOwnProperty(optionName) && optionName !== '_') {
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
    // now append the "_" which are not "options" but args
    if (fromOptions && fromOptions._) {
        [].concat(fromOptions._).forEach(function(arg) {
           options.push(arg);
        });
    }
}

module.exports = DockerCmd;