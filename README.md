# docker-cmd

[![Build Status](https://travis-ci.org/iorga-group/docker-cmd.svg?branch=master)](https://travis-ci.org/iorga-group/docker-cmd)

> Node.js libraries and binaries used to call the docker command line and manage docker from a json file.

## Installation
`npm install -g docker-cmd` or as a dependency in your `package.json` if you want to use the library part.

## Usage
`docker-cm` (for "docker command manager") will read a `dockerdesc.json` file and call `docker` with the parameters described in that file.

```asciidoc
Usage: docker-cm [options] [command]

Commands:

build <imageName>
   build the given image described in the dockerdesc file

run <containerName>
   run the given container described in the dockerdesc file

*
   display the help


Options:

-h, --help               output usage information
-V, --version            output the version number
-C, --dockerdesc <PATH>  Specify the path to the dockerdesc file. Defaults to <./dockerdesc.json>
-H, --host <HOST>        Specify the docker host. Defaults to <unix:///var/run/docker.sock>
```

In a `dockerdesc.json`, you have 3 parts :
 * the **builds** descriptions
 * the **runs** descriptions
 * the **templates** descriptions

### Build descriptions

```json
"builds": {
  "name_of_the_build": {
    "path": {string} Path to the Dockerfile parent dir or path to the Dockerfile (relative to the dockerdesc.json file)
    "buildParent": {boolean=true} Whether to build parent or not
    "buildTagFromBuildName": {boolean=true} - Whether to automatically add a "-tag" for the build command from the name of the build description
    "templates": {string|string[]} The templates to inherit from
    "host": {string} Docker host (will be passed to command with `docker -H=<host>`)
    "options": {Object} Build options
```

By default, when building an image, `docker-cm` will look in the target `Dockerfile` the `FROM` instruction in order to check if that "parent" image is described itself in the `dockerdesc.json`. If it is the case, and `buildParent` is true, `docker-cm` will first build the parent image.

### Run descriptions

```json
"runs": {
  "name_of_the_run": {
    "image": {string} Image name to run
    "command": {string[]} The command and its args
    "useRunName": {boolean=true} Whether to automatically add a "--name" for the run command from the name of the run description
    "templates": {string|string[]} The templates to inherit from
    "host": {string} Docker host (will be passed to command with `docker -H=<host>`)
    "options": {Object} Run options
```

### Options
The options (both for `run` or `build` docker command) are the arguments that will be passed to docker directly.
For example, if you want to run `docker run --interactive=true -t ubuntu` the `options` json object will be :

```json
"options": {
  "interactive": true,
  "t": null
}
```

### Templates

```json
"templates": {
  "builds": {
    "name_of_that_build_template": {
      // same json part as a normal build description
    }
  },
  "runs": {
    "name_of_that_run_template": {
      // same json part as a normal run description
      
      
```

In the templates, you set the properties that will be added to the description (run or build) which call them by specifying `"templates": ["name_of_one_template", "name_of_a_second_one"]`.

If you name a template "`default`", it will be activated by default without specifying it in a `"templates"` property.

### Defaults
Here are the defaults that are applied if not specified.

Default `run` description:

```json
{
    "useRunName": true
}
```

Default `build` description:

```json
{
    "buildTagFromBuildName": true,
    "buildParent": true
}
```

### Example
Here is a sample `dockerdesc.json` file :

```json
{
	"templates": {
		"runs": {
			"default": {
				"options": {
					"tty": "true",
					"detach": "true",
					"interactive": "true"
				}
			}
			"attached": {
				"options": {
				    "detach": "false",
				}
			}
		}
	},
	"builds": {
		"iorga_group/java7": {
			"path": "java7",
			"options": {
				"tag": "java"
			}
		},
		"iorga_group/tomcat7": {
			"path": "tomcat7"
		}
	},
	"runs": {
		"tomcat7": {
			"image": "iorga_group/tomcat7",
			"options": {
				"publish": ["8080:8080", "8009:8009"]
			}
		},
		"tomcat7-backup": {
			"image": "ubuntu",
			"templates": "attached",
			"options": {
				"rm": true,
				"volumes-from": "tomcat7",
				"volume": "/tmp:/tmp"
			},
			"command": ["/bin/bash", "-c", "cd /opt/tomcat7 && tar czf /tmp/tomcat7_backup.tgz ./"]
		}
	}
}
```

## Using `DockerCmd`
Here is a sample code :

```javascript
var DockerCmd = require("docker-cmd");
var dockerCmd = new DockerCmd();

dockerCmd.build({tag: 'test'}, './test', function(dockerBuildExitCode) {
  console.log('test built');
  
  if (dockerBuildExitCode === 0) {
    dockerCmd.run({name: 'test'}, 'test', null, function(dockerRunExitCode) {
      console.log('test run and finished.');
    });
  }
});
```

That object will call the `docker` command with all the options you gave as a first parameter.

It has no complex logic and will just call the `docker` command with the given parameters.

Find the complete doc directly [in `DockerCmd` sources](lib/docker-cmd.js).


## Using `DockerCmdManager`
Here is a sample code :

```javascript
var DockerCmdManager = require("docker-cmd").Manager;
var dockerCmdManager = new DockerCmdManager('./test/dockerdesc.json');

dockerCmdManager.build('test', function(dockerBuildExitCode) {
  console.log('test built');
  
  if (dockerBuildExitCode === 0) {
    dockerCmdManager.run('test', function(dockerRunExitCode) {
      console.log('test run and finished.');
    });
  }
});
```

That object will read a `dockerdesc.json` file and call a `DockerCmd` with the parameters specified in the dockerdesc.

`DockerCmdManager` handles dependencies between builds.

`docker-cm` command line uses that object.

Find the complete doc directly [in `DockerCmdManager` sources](lib/docker-cmd-manager.js).