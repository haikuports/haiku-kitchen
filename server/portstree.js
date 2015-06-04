/*
 * Copyright 2015 Haiku, Inc. All rights reserved.
 * Distributed under the terms of the MIT License.
 *
 * Authors:
 *		Augustin Cavalier <waddlesplash>
 */

var log = require('debug')('kitchen:portstree'), fs = require('fs'),
	shell = require('shelljs'), zlib = require('zlib'), glob = require('glob'),
	Recipe = require('./recipe.js');

/*! This manages the HaikuPorts tree that Kitchen uses. */

if (!shell.which('git')) {
	log('FATAL: git must be installed.');
	process.exit(2);
}

module.exports = function () {
	// Having these functions be inline instead of in a prototype consumes more
	// RAM, but since there should only be one instance of this object anyway
	// it shouldn't be an issue.

	this._updateClientCache = function () {
		var newClientRecipes = [];
		for (var i in this.recipes) {
			newClientRecipes.push({
				name: this.recipes[i].name,
				category: this.recipes[i].category,
				version: this.recipes[i].version,
				revision: this.recipes[i].revision,
				lint: '?'
			});
		}
		var thisThis = this;
		zlib.gzip(JSON.stringify(newClientRecipes), {level: 9}, function (err, res) {
			thisThis.clientRecipes = res;
		});
	};
	this._updateCacheFor = function (files) {
		log('updating ' + files.length + ' entries...');
		for (var i in files) {
			var recipe = new Recipe(files[i]);
			this.recipes[recipe.name + '-' + recipe.version] = recipe;
		}
		this._updateClientCache();
		log('recipe metadata update complete.');
	};
	this._completeCacheRebuild = function () {
		this.recipes = {};
		this._updateCacheFor(glob.sync('cache/haikuports/*-*/*/*.recipe'));
	};

	this._createCache = function () {
		log('creating cache from scratch...');
		shell.rm('-rf', 'cache');
		shell.mkdir('cache');
		shell.cd('cache');
			log('cache: cloning haikuports...');
			var res = shell.exec('git clone --depth=1 https://bitbucket.org/haikuports/haikuports.git',
				{silent: true});
			if (res.code !== 0) {
				log('FATAL: cloning haikuports failed: ' + res.output);
				process.exit(3);
			}
		shell.cd('..');
		_completeCacheRebuild();
	};

	if (!fs.existsSync('cache/haikuports/'))
		this._createCache();
	else
		this._completeCacheRebuild();

	this.update = function () {
		log('running git-pull...');
		shell.cd('cache/haikuports');
			shell.exec('git pull --ff-only', {silent: true}, function (code, output) {
				if (code) {
					log('git-pull failed: ' + output);
					log('recreating cache...');
					_createCache();
				} else if (output.indexOf('Already up-to-date.') >= 0) {
					log('git-pull finished, no changes');
				} else {
					log('git-pull finished, updating cache...');
					_completeCacheRebuild();
				}
			});
		shell.cd('../..');
	};
};
