'use strict';

/**
 * dockerdesc.json file description
 * @typedef {Object.<string, Object.<string, Description>>} Dockerdesc
 * @property {Templates} templates - Templates
 * @property {BuildDescriptions} build - The build descriptions
 * @property {RunDescriptions} run - The run descriptions
 */

/**
 * Templates description.
 * @typedef {Object.<string, Object.<string, Description>>} Templates
 * @property {BuildDescriptions} build - The build templates
 * @property {RunDescriptions} run - The run templates
 */

/**
 * Generic command description.
 * @typedef {Object} Description
 * @property {string|string[]} templates - The templates to inherit from
 * @property {Object} dockerOptions - Options to pass to <code>docker<code> before the command name
 * @property {Options} options - Options to pass to <code>docker<code> after the command name (therefore these are the command options)
 */

/**
 * Docker command options.
 * @typedef {Object} Options
 * @property {string|string[]} _ - Arguments to pass after the command options
 */

/**
 * Build descriptions.
 * @typedef {Object.<string, BuildDescription>} BuildDescriptions
 */

/**
 * Build description.
 * @typedef {Object} BuildDescription
 * @extends {Description}
 * @property {string} path - Path to the Dockerfile parent dir or path to the Dockerfile (relative to the dockerdesc.json file)
 * @property {boolean} [buildParent=true] - Whether to build parent or not
 * @property {boolean} [buildTagFromBuildName=true] - Whether to automatically add a "-tag" for the build command from the name of the build description
 * @property {BuildOptions} options - Build options
 */

/**
 * @typedef {Object} BuildOptions
 * @extends {Options}
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
 * @extends {Description}
 * @property {string} image - Image name to run
 * @property {string|string[]} command - The command and its args
 * @property {boolean} [useRunName=true] - Whether to automatically add a "--name" for the run command from the name of the run description
 * @property {RunOptions} options - Run options
 */

/**
 * @typedef {Object} RunOptions
 * @extends {Options}
 * @property {string} name - Assign a name to the container
 */