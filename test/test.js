
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
		epub2web.reader(
			urlparts[1],
			myTemplateName,
			cacheDir,
			function (err, cacheId, htmlApp) { // callback after webify completes

				// the htmlApp is the whole reading system,
				// fully configured for this cacheId, so
				// just pass it right to the browser

				if(err) {
					res.writeHead(500, {'Content-Type': 'text/html'});
					res.end('An error occurred');
				}
					res.writeHead(200, {'Content-Type': 'text/html'});
					res.end(htmlApp);
				});
			} else if (urlparts = req.url.match(/\/cache\/([^\/]+?)\/(.+?)$/)) { /* get file from cache */

			// Fix for cacheID that sometimes gets transmitted as well
			
			if(!urlparts[0].match(/^[0-9a-f]{32}$/i)) {
				var filename = cacheDir +'/'+ urlparts[1]+'/'+urlparts[2];
			}	else {
				var filename = urlparts[1]+'/'+urlparts[2];
			}

			console.log('filename is equal to ', filename);
			try {
				//Replaced sync calls with async calls
		    var content, stat, realpath;
				fs.realpath(filename, function (err, path) {
					if (err) {
						console.log('realPath not found');
						res.end('Unable to resolve path');
						return(err);
					}
					realpath = path;
					fs.readFile(filename, function (err, data) {
						if (err) {
							if (err.code === 'EISDIR') {
								console.log('trying to read a directory');
								res.end('Not A Valid File');
							}
							return (err);
						}
						content = data;
						fs.stat(path, function (err, stats) {
							if (err) {
								throw err;
							}
							stat = stats;
							res.writeHead(200, {
								'Content-Type': mime.lookup(filename),
								'Content-Length': stat.size
							});
		    			res.end(content);
						});		
					});
				});
			} catch (e) {
				if (e.code === 'ENOENT') {
					if (filename.match(/[0-9a-f]{32}/)) {
						console.log('No file, yet there is a cacheId, -> Adjust the JSON?');
						console.log(urlparts[0] + '   ' + urlparts[1] + '   ' + urlparts[2]);
						//So we'd need to add opsroot between [1] and [2] for Moby Dick, fix incoming need to adjust the JSON itself for this
					} else {
						console.log('No file, and there\'s not even a cacheId -> Adjust the JSON?');
						console.log(urlparts[0] + '   ' + urlparts[1] + '   ' + urlparts[2]);
						//This is the part for epub 3 spec, so that needs cacheID AND opsRoot appended... tricky
					}
				} else if (e.code === 'EISDIR') {
					console.log('Directory requested, undefined behavior for now'); //hould be fixed via #toc changes in testreader

/*
					epub2web.reader(
						urlparts[1],
						myTemplateName,
						cacheDir,
						function (err, cacheId, htmlApp) { // callback after webify completes

							if(err) {
								res.writeHead(500, {'Content-Type': 'text/html'});
								res.end('An error occurred');
							}
						res.writeHead(200, {'Content-Type': 'text/html'});
						res.end(htmlApp);
					}); 
*/
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

					// the htmlApp is the whole reading system,
					// fully configured for this cacheId, so
					// just pass it right to the browser

					var cacheurl = '/cache/'+cacheId+'/';

					res.writeHead(302, {
						'Location': cacheurl
					});
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
