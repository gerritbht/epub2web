var cacher = require('epub-cache');
var fs = require('fs');
var tmpl = require('epub-tmpl');
var epubdir;
var path, filelist, tm, endtm;
var listing = [];
var opened = 0;
var total = 0;
var finalCb = function () {};
var listeners = {};
var tester = require('../node_modules/epub-cache/node_modules/epub2html');
var parser = tester.getParser();

module.exports.maxFiles = total;

module.exports.attach = function attach(cacheDir) {
	cacher.init({
		cacheDir: cacheDir,
		idLimit: 100
	});
}

module.exports.addTemplate = function addTemplate(name, html) {

	// wraps epub-tmpl addTemplate function to add custom reading system templates
	//console.log('debug->2web->adding template '+name+' with '+html.length+' bytes of HTML');
	tmpl.addTemplate(name, html);
}

// use webify if you don't have a cacheId or are not sure what it is
module.exports.webify = function webify(epubfile, templateName, cb) {
	cacher.cache(epubfile, function (err, cacheId, bundle) {
		if(err) {
			//console.log('debug->2web->error in webify + ', err);
			return cb(err, null, null); 
		}
		var config = JSON.stringify(bundle);
		var template = tmpl.getTemplate(templateName);
		var html = load(config, {
			cacheId: cacheId,
			template: template,
			configline: 'reader.config = {};'
		});
		cb(null, cacheId, html);
	});
}

// use reader if you already have a cacheId, use webify if you don't or are not sure what it is, so this reads from an existing cache
module.exports.reader = function reader(cacheId, templateName, cacheDirectory, cb) {
	console.log('using reader for ' + cacheId + " at " + cacheDirectory);
	try {
		var template = tmpl.getTemplate(templateName);

		fs.readFile(cacheDirectory+'/'+cacheId+'\.json', function (err, data) {
			console.log('reading file');
			if (err) throw err;
			var config = data;
			var html = load(config, {
				cacheId: cacheId,
				template: template,
				configline: 'reader.config = {};'
			});
			cb(null, cacheId, html);
		});
	} catch(e) {
		console.log('Error in reader function', e);
		cb(e, null, null);
	}
}

module.exports.buildIndex = function (dir, cb) {
	epubdir = dir;
	finalCb = cb;
	fs.readdir(dir, opendirCallback);
}

module.exports.getCacher = function () {
	return cacher;
}

module.exports.loadIndex = function (index, cb) {
	listing = JSON.parse(index);
	cb(null, listing);
}

module.exports.on = function (topic, listener) {
	if(typeof listeners[topic] == 'undefined') {
		listeners[topic] = [];
	}
	listeners[topic].push(listener);
}

function opendirCallback (err, files) {
	if(err) throw err;

	filelist = files;
	epublist = [];

	for(var i = 0 ; i < filelist.length; i++) {
		if(filelist[i].match(/\.epub$/i)) {
			epublist.push(filelist[i]);
		}
	}
	tm = (new Date()).getTime();
	if(module.exports.maxFiles > 0 && module.exports.maxFiles < epublist.length) {
		total = module.exports.maxFiles;
	} else {
		total = epublist.length;
	}
	for(var i = 0 ; i < epublist.length; i++) {
		try {
			console.log('opening: '+epubdir + '/' +epublist[i]);
			parser.open(epubdir + '/' +epublist[i], openCallback);
		} catch (e) {
			openCallback(e);
		}
	}
}

function openCallback(err, epubData) {
	if(!err) {
		path = epubdir + '/' +epublist[opened];
		console.log('------->'+Math.floor((opened/total)*100)+'%');
		var o = {
			path: path,
			primaryId: epubData.easy.primaryID.value,
			cover: epubData.easy.epub2CoverUrl,
			coverData: new Buffer(parser.extractBinary(epubData.easy.epub2CoverUrl),'binary'),
			simpleMeta: epubData.easy.simpleMeta,
			epubData: epubData
		};
		listing.push(o);
		notify('newItem',o);
		opened++;
		console.log('opened '+opened+' out of '+total);
		if(opened==total) {
			endtm = (new Date()).getTime();
			console.log('ending read ops at '+endtm);
			console.log('took '+((endtm-tm)/1000/60)+' minutes');
			console.log('opened '+opened+' files');
			finalCb(null, listing);
		}
	} else {	
		opened++;
		console.log(err);
	}
}

function notify(topic, data) {
	for(topic in listeners) {
		for(var i = 0; i < listeners[topic].length; i ++) {
			listeners[topic][i].apply(this, [data]);
		}
	}
}

function load(contentConfig, readerConfig) {

	// load a cacher generated config block
	// into the reader templates
	// and return the decorated html
	
	//console.log('Loading config ', readerConfig.cacheId);
	var cacheId = readerConfig.cacheId;

	return readerConfig.template.replace(
		readerConfig.configline,
		readerConfig.configline.replace(/\{\}/, contentConfig)+ '; var __epubCacheId="'+cacheId+'";'
	);
}
