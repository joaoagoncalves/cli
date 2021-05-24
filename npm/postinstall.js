#!/usr/bin/env node

"use strict";

const path = require('path'),
    mkdirp = require('mkdirp'),
    envPaths = require('env-paths'),
    rimraf = require('rimraf'),
    fs = require('fs'),
    node_modules = require('node_modules-path'),
    { parsePackageJson, PLATFORM_MAPPING, ARCH_MAPPING } = require('./utils');

async function getInstallationPath() {

    // `npm bin` will output the path where binary files should be installed

    // const value = await execShellCommand("npm bin -g");


    //     var dir = null;
    //     if (!value || value.length === 0) {

    //         // We couldn't infer path from `npm bin`. Let's try to get it from
    //         // Environment variables set by NPM when it runs.
    //         // npm_config_prefix points to NPM's installation directory where `bin` folder is available
    //         // Ex: /Users/foo/.nvm/versions/node/v4.3.0
    //         var env = process.env;
    //         if (env && env.npm_config_prefix) {
    //             dir = path.join(env.npm_config_prefix, "bin");
    //         }
    //     } else {
    //         dir = value.trim();
    //     }

    //     await mkdirp(dir);
    if (!!process.env.npm_config_global) {
        // install into home:
        // win: /AppData/Local/CMF/cmf-cli
        // linux: ~/.local/share/cmf-cli
        // osx: ~/Library/Application Support/cmf-cli
        const paths = envPaths("cmf-cli", {suffix: ""});
        await mkdirp(paths.data);
        return paths.data;
    } else {
        // install into node_modules/.bin/cmf-cli
        const value = path.join(node_modules(), ".bin");
        const dir = path.join(value, "cmf-cli");
        return dir;
    }
}

async function verifyAndPlaceBinary(binName, binPath, callback) {
    // console.log(binPath, binName);
    if (!fs.existsSync(path.join(binPath, binName))) return callback('Downloaded binary does not contain the binary specified in configuration - ' + binName);

    // Get installation path for executables under node
    // const installationPath=  await getInstallationPath();
    // Link the executable to the path
    // console.log(path.join(installationPath, binName));
    // fs.rename(path.join(binPath, binName), path.join(installationPath, binName),(err)=>{
    //     if(!err){
    //         console.info("Installed cli successfully");
    //         callback(null);
    //     }else{
    //         callback(err);
    //     }
    // });
    // fs.symlinkSync(path.join(binPath, binName), path.join(installationPath, binName));
    return callback(null);
}

/**
 * Reads the configuration from application's package.json,
 * validates properties, copied the binary from the package and stores at
 * ./bin in the package's root. NPM already has support to install binary files
 * specific locations when invoked with "npm install -g"
 *
 *  See: https://docs.npmjs.com/files/package.json#bin
 */
var INVALID_INPUT = "Invalid inputs";
async function install(callback) {

    var opts = parsePackageJson(".");
    if (!opts) return callback(INVALID_INPUT);
    console.info(`Copying the relevant binary for your platform ${process.platform}`);
    const src= `./dist/${PLATFORM_MAPPING[process.platform]}-${ARCH_MAPPING[process.arch]}`;
    const installPath = await getInstallationPath();
    if (process.platform === "win32") {
        await execShellCommand(`robocopy ${src.replace(/\//g, "\\")} ${installPath} /e /is /it`, [1]);
    } else {
        await execShellCommand(`cp -r ${src}/** ${installPath}`);
    }
    
    await verifyAndPlaceBinary(opts.binName, installPath, callback);
}

async function uninstall(callback) {
    var opts = parsePackageJson(".");
    try {
        const installationPath = await getInstallationPath();
        rimraf.sync(installationPath);
    } catch (ex) {
        console.log(ex);
        callback(ex);
        // Ignore errors when deleting the file.
    }
    console.info("Uninstalled cli successfully");
    return callback(null);
}

// Parse command line arguments and call the right method
var actions = {
    "install": install,
    "uninstall": uninstall
};
/**
 * Executes a shell command and return it as a Promise.
 * @param cmd {string}
 * @return {Promise<string>}
 */
function execShellCommand(cmd, valid_error_codes = null) {
    const exec = require('child_process').exec;
    return new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                let shouldPrint = true;
                if (valid_error_codes != null) {
                    shouldPrint = valid_error_codes.indexOf(error.code) < 0;
                }
                shouldPrint && console.warn(error);
            }
            resolve(stdout? stdout : stderr);
        });
    });
}

var argv = process.argv;
if (argv && argv.length > 2) {
    var cmd = process.argv[2];
    if (!actions[cmd]) {
        console.log("Invalid command. `install` and `uninstall` are the only supported commands");
        process.exit(1);
    }

    actions[cmd](function (err) {
        if (err) {
            console.error(err);
            process.exit(1);
        } else {
            process.exit(0);
        }
    });
}