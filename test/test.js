'use strict';

var assert = require('assert');
//var should = require('should');
var sinon = require('sinon');
var mockSpawn = require('mock-spawn');
var child_process = require('child_process');
var DockerCmdManager = require('../lib/docker-cmd-manager');

function assertDockerCalledWith() {
    sinon.assert.calledWith(child_process.spawn, '/usr/bin/env', ['docker'].concat(Array.prototype.slice.call(arguments)));
}

describe('DockerCmdManager', function() {
    var spawnStub;
    beforeEach(function() {
        spawnStub = sinon.stub(child_process, 'spawn', mockSpawn());
    });
    afterEach(function() {
        child_process.spawn.restore();
        spawnStub = null;
    });
    it('should build dependencies by default', function(done) {

        new DockerCmdManager('./test/resources/dockerdesc1.json').build('iorga_group/main', function() {
            sinon.assert.calledThrice(child_process.spawn);

            done();
        });
    });
    it('should allow the choice not to build parents', function(done) {

        new DockerCmdManager('./test/resources/dockerdesc2.json').build('iorga_group/main', function() {
            sinon.assert.calledTwice(child_process.spawn);

            done();
        });
    });
    it('should take build tag name from the build name by default', function(done) {

        new DockerCmdManager('./test/resources/dockerdesc1.json').build('iorga_group/dep2', function() {
            sinon.assert.calledOnce(child_process.spawn);
            assertDockerCalledWith('build', '--tag=iorga_group/dep2', 'test/resources/dep2');

            done();
        });
    });
    it('should take build tag name from the build options if specified', function(done) {

        new DockerCmdManager('./test/resources/dockerdesc1.json').build('iorga_group/main', function() {
            assertDockerCalledWith('build', '--tag=iorga_group/main2', 'test/resources/main');

            done();
        });
    });
    it('should allow bypassing automatic build tag name', function(done) {

        new DockerCmdManager('./test/resources/dockerdesc3.json').build('iorga_group/dep2', function() {
            assertDockerCalledWith('build', 'test/resources/dep2');

            done();
        });
    });
    it('should use the run name from the dockerdesc by default', function(done) {

        new DockerCmdManager('./test/resources/dockerdesc1.json').run('dep1', function() {
            assertDockerCalledWith('run', '--name=dep1', 'iorga_group/dep1');

            done();
        });
    });
    it('should repeat the same parameter if an array is specified for an option', function(done) {

        new DockerCmdManager('./test/resources/dockerdesc1.json').run('dep2', function() {
            assertDockerCalledWith('run', '-p', '8083:8080', '-p', '8012:8009', '--name=dep2', 'iorga_group/dep2');

            done();
        });
    });
    it('should repeat the same parameter if an array is specified for an option', function(done) {

        new DockerCmdManager('./test/resources/dockerdesc1.json').run('main', function() {
            assertDockerCalledWith('run', '--tty=true', '--detach', '--name=main', 'iorga_group/main');

            done();
        });
    });

});