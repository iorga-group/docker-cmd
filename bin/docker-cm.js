#!/usr/bin/env node
'use strict';

// Lib
var DockerCmdManager = require('../lib/docker-cmd-manager');

var parseArgs = require('minimist'); // thanks to http://stackoverflow.com/a/24638042/535203
var util = require('util');
var M = require('mstring');

var usage = util.format(M(function() {
    /***
%s executes the given docker command, reading arguments from the given dockerdesc file and the given options and args.

Usage: %s [options] [dockerOptions] <commandName> [descriptionOptions] <descriptionTarget> [commandOptions] [commandArgs]

Options:
     -h, --help               output usage information
     -V, --version            output the version number
     -C, --dockerdesc <PATH>  Specify the path to the dockerdesc file. Defaults to <./dockerdesc.json>

DockerOptions:      All the options you want to pass to docker command before the command name

CommandName:        The docker command name to execute

DescriptionOptions: Options depending on the command, overriding the ones from the dockerdesc

DescriptionTarget:  Name of the target to read from the dockerdesc

CommandOptions:     All the options to override from the dockerdesc file

CommandArgs:        The args to pass to the docker command, after the command options, overriding those described in the dockerdesc file
    ***/
}), process.argv[1], process.argv[1]);

function help(exitStatus) {
    console.log(usage);
    process.exit(exitStatus);
}
var dockerOptions = parseArgs(process.argv.slice(2), {stopEarly: true});
if (dockerOptions.h || dockerOptions.help) {
    help(0);
} else if (dockerOptions.V || dockerOptions.version) {
    console.log(require('../package.json').version);
}

if (!dockerOptions._ || dockerOptions._.length < 2) {
    console.error('Must at least have <commandName> AND <descriptionTarget>');
    help(1);
} else {
    var commandName = dockerOptions._[0];
    var commandFunction = new DockerCmdManager(program.dockerdesc)[commandName];
    if (typeof commandFunction !== 'function') {
        console.error(util.format('"%s" command doesn\'t exist.', commandName));
        help(2);
    } else {
        var dockerdesc = dockerOptions.C || dockerOptions.dockerdesc;
        var descriptionOptions = parseArgs(dockerOptions._.slice(1), {stopEarly: true});
        // for those options, we have to convert from regular command arg (using "-") to camelCase
        Object.getOwnPropertyNames(descriptionOptions).forEach(function (optionName) {
            var optionValue = descriptionOptions[optionName];
            // to camelCase
            var camelCaseOptionName = optionName.toLowerCase().replace(/-(.)/g, function(match, group1) { // thanks to http://stackoverflow.com/a/10425344/535203
                return group1.toUpperCase();
            });
            delete descriptionOptions[optionName];
            descriptionOptions[camelCaseOptionName] = optionValue;
        });
        var descriptionTarget = (descriptionOptions._ || [])[0];
        if (!descriptionTarget) {
            console.error('Must at least have <descriptionTarget>');
            help(3);
        } else {
            var commandOptions = parseArgs(descriptionOptions._.slice(1), {stopEarly: true});
            delete dockerOptions._; // not a docker option
            delete dockerOptions.C; // not a docker option
            delete dockerOptions.dockerdesc; // not a docker option
            commandFunction(descriptionTarget, descriptionOptions, commandOptions, dockerOptions, function(dockerProcessExitCode) {
                process.exit(dockerProcessExitCode);
            });
        }
    }
}
