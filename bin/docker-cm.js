#!/usr/bin/env node
'use strict';

// Lib
var DockerCmdManager = require('../lib/docker-cmd-manager');
var packagejson = require('../package');

var program = require('commander'); // thanks to http://stackoverflow.com/q/4351521/535203

program
    .version(packagejson.version)
    .option('-C, --dockerdesc <PATH>', 'Specify the path to the dockerdesc file. Defaults to <./dockerdesc.json>', './dockerdesc.json')
    .option('-H, --host <HOST>', 'Specify the docker host. Defaults to <unix:///var/run/docker.sock>', 'unix:///var/run/docker.sock')
;

function launchCommand(commandName, arg) {
    try {
        new DockerCmdManager(program.dockerdesc, program.host)[commandName](arg, function(dockerProcessExitCode) {
            process.exit(dockerProcessExitCode);
        });
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
}

program
    .command('build <imageName>')
    .description('build the given image described in the dockerdesc file')
    .action(function(imageName) {
        launchCommand('build', imageName);
    });

program
    .command('run <containerName>')
    .description('run the given container described in the dockerdesc file')
    .action(function(containerName) {
        launchCommand('run', containerName);
    });

program
    .command('*')
    .description('display the help')
    .action(function() {
        program.help();
    });

program.parse(process.argv);

if (process.argv.length < 3) {
    program.help();
}