'use strict';

/**
 * dockerdesc.json file description
 * @typedef {Object} Dockerdesc
 * @property {Templates} templates - Templates
 * @property {BuildDescriptions} builds - The build descriptions
 * @property {RunDescriptions} runs - The run descriptions
 */

/**
 * Templates description.
 * @typedef {Object} Templates
 * @property {BuildDescriptions} builds - The build templates
 * @property {RunDescriptions} runs - The run templates
 */

/**
 * Build descriptions.
 * @typedef {Object.<string, BuildDescription>} BuildDescriptions
 */

/**
 * Build description.
 * @typedef {Object} BuildDescription
 * @property {string|string[]} templates - The templates to inherit from
 * @property {string=} host - Docker host (will be passed to every command with `docker -H=<host>`
 * @property {string} path - Path to the Dockerfile parent dir or path to the Dockerfile
 * @property {boolean=true} buildParent - Whether to build parent or not
 * @property {boolean=true} buildTagFromBuildName - Whether to automatically add a "-tag" for the build command from the name of the build description
 * @property {BuildOptions} options - Build options
 */

/**
 * @typedef {Object} BuildOptions
 * @property {string} tag - Repository name (and optionally a tag) to be applied to the resulting image in case of success
 * @property {string} t - Alias for <code>tag</code> property
 */

/**
 * Run descriptions.
 * @typedef {Object.<string, RunDescription>} RunDescriptions
 */

/**
 * Run description.
 * @typedef {Object} RunDescription
 * @property {string|string[]} templates - The templates to inherit from
 * @property {string=} host - Docker host (will be passed to every command with `docker -H=<host>`
 * @property {string} image - Image name to run
 * @property {string[]} command - The command and its args
 * @property {boolean=true} useRunName - Whether to automatically add a "--name" for the run command from the name of the run description
 * @property {RunOptions} options - Run options
 */

/**
 * @typedef {Object} RunOptions
 * @property {string} name - Assign a name to the container
 */