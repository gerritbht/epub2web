
// example usage: reading epubs in your browser

var http = require('http');
var fs = require('fs');
var mime = require('mime');

var epub2web = require('../index.js');
var port = 8124;
var cacheDir = __dirname+'/../www/cache';
var epubDir = __dirname+'/epubs';

var myTemplateName = 'testreader';
var myTemplateHtml = fs.readFileSync(__dirname+'/testreader.html');
//var myTemplateHtml = fs.readFileSync(__dirname+'/index.html');

// for on-the-fly script injection into content docs

//var htmlparser = require('htmlparser');
//var jsdom = require("jsdom").jsdom;

// add custom reading template
console.log("debug->test->cacheDir =  ", cacheDir);
epub2web.attach(cacheDir);
epub2web.addTemplate(myTemplateName, myTemplateHtml.toString());

function injectScript(rs,content,cb) {
/*
	jsdom.env(
		content.toString(),
		[],
		function (errors, window) {
			var b = window.document.getElementsByTagName('body').item(0);
			var html = b.innerHTML + rs;
			b.innerHTML = html;
			cb(window.document.innerHTML);
		}
	); */
	var newcontent = content.toString().replace(/<\/body>/igm, rs+'<!-- foo --></body>');
	cb(newcontent);
}

function refreshTemplate()
{
	// function to ease development, call to refresh the html
	// without a server restart. should not be used in production.
	
	//console.log('debug->test->refreshing template...', __dirname+'/testreader.html');
	fs.readFile(__dirname+'/testreader.html', function (err, data) {
		if (err) throw err;
		myTemplateHtml = data;
		epub2web.addTemplate(myTemplateName, myTemplateHtml.toString());
	});
}

// attach to any cache dir you want for cache location of exploded epubs

epub2web.attach(cacheDir);

// your server will be much more sophisticated than this, of course ...

var server = http.createServer(function (req,res) {

	var urlparts;
	var tempID = 'PLACEHOLDER';

	if(req.url=='/favicon.ico') {
		res.writeHead(200, {'Content-Type': 'image/png'});
		res.end('');
	} else if(req.url=='/') {
		// serves up the test launch page with a convenient link to an epub in our test dir
    res.writeHead(200, ['Content-Type', 'text/html']);
    res.write('<p>Append an epub filename onto the /read/ URL ');
    res.end('to read the file! (try <a href="http://'+req.headers.host+'/read/testbook.epub">the test file</a> for starters)');
	} /* get from cacheId */
	else if (urlparts = req.url.match(/\/cache\/([^\/]+?)\/?$/)) { /* This is the part where it should read from cache */

		refreshTemplate();
		tempID = urlparts[1];
		epub2web.reader(
			urlparts[1],
			myTemplateName,
			cacheDir,
			function (err, cacheId, htmlApp) { // callback after webify completes
				if (cacheId !== 'undefined') {
					tempID = cacheId;	//doesn't work
					console.log('tempID = ', tempID);
				}

				// the htmlApp is the whole reading system,
				// fully configured for this cacheId, so
				// just pass it right to the browser

				if(err) {
					res.writeHead(500, {'Content-Type': 'text/html'});
					res.end('An error occurred');
				}
				tempID = cacheId; // doesn't work
				console.log('tempId 2 = ', tempID);
				res.writeHead(200, {'Content-Type': 'text/html'});
				res.end(htmlApp);
			});
	} else if (urlparts = req.url.match(/\/cache\/([^\/]+?)\/(.+?)$/)) { /* get file from cache */
			var cid = urlparts[1];
			if(urlparts[1] === 'css') {
				if(!urlparts[0].match(/^[0-9a-f]{32}$/i)) {
					console.log('NoCacheUrlparts is = ', urlparts[0] +'\n'+urlparts[1]+'\n'+urlparts[2]+'\n'+urlparts[3]);
					var filename = cacheDir +'/'+tempID+'/'+urlparts[1]+'/'+urlparts[2]; //even w/ tempID fake this is still missing the OPSRoot, so go at it from the html
				}
			}	else {
				console.log('NoCSSUrlparts is = ', urlparts[0] +'\n'+urlparts[1]+'\n'+urlparts[2]+'\n'+urlparts[3]);
				var filename = cacheDir +'/'+urlparts[1]+'/'+urlparts[2];				
			}

/*
			if(!urlparts[1].match(/^[0-9a-f]{32}$/i)) {
				console.log('caught it, this should be the css file'); 
				console.log('cacheDir = ', tempID);
				try {
					var realpath = fs.realpathSync(cacheDir+'/'+filename);
					var stat = fs.statSync(cacheDir+'/'+realpath);
					var content = fs.readFileSync(cacheDir+'/'+filename);

					console.log('trying second path', cacheDir+'/'+filename);

					res.writeHead(200, {
						'Content-Type': mime.lookup(filename),
						'Content-Length': stat.size
					});
					res.end(content);
				} catch (e) {
					console.log(e);
					res.end('Not Found');
				}
			}
*/

			console.log('filename is equal to ', filename);
			try {
				var realpath = fs.realpathSync(filename);
				var stat = fs.statSync(realpath);
				var content = fs.readFileSync(filename);

				res.writeHead(200, {
					'Content-Type': mime.lookup(filename),
					'Content-Length': stat.size
				});
		    res.end(content);				
			} catch (e) {
				if (e.code === 'ENOENT') {
					if (filename.match(/[0-9a-f]{32}/)) {
						console.log('Yet there is a cacheId, -> Adjust the JSON?');
						console.log(urlparts[0] + '   ' + urlparts[1] + '   ' + urlparts[2]);
						//So we'd need to add opsroot between [1] and [2] for Moby Dick, fix incoming need to adjust the JSON itself for this
					} else {
						console.log('And there\'s not even a cacheId -> Adjust the JSON?');
						console.log(urlparts[0] + '   ' + urlparts[1] + '   ' + urlparts[2]);
						//This is the part for epub 3 spec, so that needs cacheID AND opsRoot appended... tricky
					}
				}
				console.log(e);
		    res.end('Not Found');
			}
	} else if (urlparts = req.url.match(/\/read\/(.+?\.epub)(.*?)$/)) { /* get from epub filename */

			refreshTemplate();

			epub2web.webify(
				epubDir+'/'+urlparts[1], /* full path of epub file */
				myTemplateName, /* template name for reading system */
				function (err, cacheId, htmlApp) { /* callback after webify complete */
				if (cacheId !== 'undefined') {
					tempID = cacheId;	
					console.log('tempID = ', tempID);
				}
					// the htmlApp is the whole reading system,
					// fully configured for this cacheId, so
					// just pass it right to the browser

					var cacheurl = '/cache/'+cacheId+'/';

					res.writeHead(302, {
						'Location': cacheurl
					});
					tempID = cacheId;
					console.log('tempID 3 = ', tempID);
					res.end();

//					res.writeHead(200, ['Content-Type', 'text/html']);
//					res.end(htmlApp);

				});

	} else if(req.url=='/close') {
		    res.writeHead(200, ['Content-Type', 'text/html']);
		    res.end('Goodbye!');
	}
});

console.log('server created - go to http://localhost:'+port+'/ to start');

server.listen( port );
