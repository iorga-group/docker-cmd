# docker-cmd

[![Build Status](https://travis-ci.org/iorga-group/docker-cmd.svg?branch=master)](https://travis-ci.org/iorga-group/docker-cmd)

> A Docker NodeJS lib wrapping the Docker command line and managing it from a json file.

## Installation
`npm install -g docker-cmd` or as a dependency in your `package.json` if you want to use it as a library.

If you have installed NodeJS on a debian based system with official packages, you have to create a symlink in order to have `node` command in the path ([like said here](http://stackoverflow.com/a/18130296/535203)):

```bash
sudo ln -s /usr/bin/nodejs /usr/bin/node
```

## Usage
`docker-cm` (for "docker command manager") will read a `dockerdesc.json` file and call `docker` with the parameters described in that file.

```asciidoc
docker-cm executes the given docker command, reading arguments from the given dockerdesc file and the given options and args.

Usage: docker-cm [options] [dockerOptions] <commandName> [descriptionOptions] <descriptionTarget> [commandOptions] [commandArgs]

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
```

The `dockerdesc.json` file allows you to store the arguments you want to give to the `docker` command, enhanced by a templates system.

Here is the format :

```json
{
    "templates": {
        "a_docker_command": {
            "name_of_a_template": {
                "a_specific_option_for_that_command": "its_value",
                "dockerOptions": {
                    "a_docker_option": "its_value"
                },
                "options": {
                    "a_docker_option_for_that_command": "its_value",
                    "_": ["args", "to", "pass", "after", "the", "options"]
                }
            }
        }
    },
    "a_docker_command": {
        "a_description_target_name": {
            "a_specific_option_for_that_command": "its_value",
            "templates": ["name_of_a_template", "name_of_another_template"],
            "dockerOptions": {
                "a_docker_option": "its_value"
            },
            "options": {
                "a_docker_option_for_that_command": "its_value",
                "_": ["args", "to", "pass", "after", "the", "options"]
            }
        }
    }
}
```

 * `a_docker_command` is for example `run` or `build` or another docker command
 * `a_docker_option` is for example `host` or `H` which corresponds to `--host` or `-H` of `docker` [command line options](https://docs.docker.com/reference/commandline/cli/) (before the COMMAND).
 * `a_specific_option_for_that_command` is a specific option used by `docker-cm` for the docker command it refers to
 * `a_docker_option_for_that_command` is an option for the docker command it refers to. For example, it is `detach` or `p` for `--detach` or `-p` options for the `run` command. See the [options definition section](#options) for more information.
 * "`_`" property in the `options` section is used for the arguments passed to the docker command after its options
 * `templates` in description sections is a list of the templates to use for that description. A template named `default` will always be used by every descriptions without specifying it. Check the [templates definition section](#templates) for more information.

### Build specific options

```asciidoc
"build": {
  "name_of_the_build": {
    "path": {string} Path to the Dockerfile parent dir or path to the Dockerfile (relative to the dockerdesc.json file)
    "buildParent": {boolean=true} Whether to build parent or not
    "buildTagFromBuildName": {boolean=true} - Whether to automatically add a "-tag" for the build command from the name of the build description
```

By default, when building an image, `docker-cm` will look in the target `Dockerfile` the `FROM` instruction in order to check if that "parent" image is described itself in the `dockerdesc.json`. If it is the case, and `buildParent` is true, `docker-cm` will first build the parent image.

You can use either the `path` property or the `options._` one.

### Run descriptions

```asciidoc
"run": {
  "name_of_the_run": {
    "image": {string} Image name to run
    "command": {string[]} The command and its args
    "useRunName": {boolean=true} Whether to automatically add a "--name" for the run command from the name of the run description
```

You can use either the `image` property then `command` one or the `options._` one.

### Options
The options (both for `run` or `build` docker command) are the arguments that will be passed to docker directly.
For example, if you want to run `docker run --interactive=true -t ubuntu` the `options` json object will be :

```asciidoc
"options": {
  "interactive": true,
  "t": null
}
```

### Templates

```asciidoc
"templates": {
  "build": {
    "name_of_that_build_template": {
      // same json part as a normal build description
    }
  },
  "run": {
    "name_of_that_run_template": {
      // same json part as a normal run description
```

In the templates, you set the properties that will be added to the description (`run`, `build` or another command) which call them by specifying `"templates": ["name_of_one_template", "name_of_a_second_one"]`.

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
		"run": {
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
	"build": {
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
	"run": {
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

dockerCmd.build({tag: 'test', _: './test'}, null, function(dockerBuildExitCode) {
  console.log('test built');
  
  if (dockerBuildExitCode === 0) {
    dockerCmd.run({name: 'test', _: 'test'}, null, function(dockerRunExitCode) {
      console.log('test run and finished.');
    });
  }
});
```

That object will call the `docker` command with all the options you gave as a first parameter.

The second parameter is used for `dockerOptions` (with a `host` property for example).

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

`DockerCmdManager` handles dependencies between builds for `build` command.

`docker-cm` command line uses that object.

Find the complete doc directly [in `DockerCmdManager` sources](lib/docker-cmd-manager.js).
