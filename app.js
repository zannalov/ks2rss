////////////////////////////////////////////////////////////////////////////////
// Modules
////////////////////////////////////////////////////////////////////////////////

var events = require('events');
var fs = require( 'fs' );
var http = require( 'http' );
var jquery = require( 'jquery' );
var jsdom = require('jsdom');
var sys = require('sys');

////////////////////////////////////////////////////////////////////////////////
// Config
////////////////////////////////////////////////////////////////////////////////

var pageLimit = 30;
var dataFile = 'projectsSeen.json';
var outFile = 'ks2rss3.xml';
var testMode = false;
var basePath = 'http://www.kickstarter.com';
var projectPrefix = 'http://www.kickstarter.com/projects/';
var stubs = {
    'Recommended': '/discover/recommended',
    'Recently Launched': '/discover/recently-launched',
    'Ending Soon': '/discover/ending-soon',
    'Small Projects': '/discover/small-projects',
    'Comics (Popular)': '/discover/categories/comics/popular',
    'Comics (Recommended)': '/discover/categories/comics/recommended',
};

jsdom.defaultDocumentFeatures = {
    FetchExternalResources: [],
    ProcessExternalResources: false
};

////////////////////////////////////////////////////////////////////////////////
// Debug code to serve sample files
////////////////////////////////////////////////////////////////////////////////

if( testMode ) {
    (function(){
        var sampleServer = http.createServer();
        sampleServer.listen( 8000 );
        sampleServer.on( 'request' , function( req , res ) {
            if( '/samples/' == req.url.substr( 0 , 9 ) ) {
                fs.readFile( '.' + req.url , function( err , data ) {
                    if( err ) {
                        res.writeHead( 500 );
                        res.end( String( err ) );
                    } else {
                        res.writeHead( 200 );
                        res.end( data );
                    }
                } );
            } else {
                res.writeHead( 400 );
                res.end( 'Bad request' );
            }
        } );

        basePath = 'http://localhost:8000/samples';
        stubs = {
            'Recommended': '/discover/recommended',
            'Ending Soon': '/discover/ending-soon',
        };
    })();
}

////////////////////////////////////////////////////////////////////////////////
// Fetch a single page
////////////////////////////////////////////////////////////////////////////////

function Page() {
    this.fetch = this.fetch.bind( this );
    this.fetchPage = this.fetchPage.bind( this );

    this.projects = [];

    events.EventEmitter.call( this );

    return this;
}
sys.inherits( Page , events.EventEmitter );

Page.prototype.basePath = null;
Page.prototype.stub = null;
Page.prototype.page = 1;
Page.prototype.rawResult = null;

// url must be fully qualified
// callback( err , data )
Page.prototype.fetchPage = function( url , callback ) {
    var req = http.request( url , function( res ) {
        // If the status code is outside the 200 range
        if( 200 > res.statusCode || 299 < res.statusCode ) {
            if( callback ) {
                callback( 'Status: ' + res.statusCode , null );
                callback = null;
            }

            return;
        }

        var body = '';
        res.setEncoding( 'utf8' );
        res.on( 'data' , function( chunk ) {
            body += chunk;
        }.bind( this ) );
        res.on( 'end' , function() {
            if( callback ) {
                callback( null , body );
                callback = null;
            }
        }.bind( this ) );
    }.bind( this ) );
    req.on( 'error' , function( e ) {
        if( callback ) {
            callback( e , null );
            callback = null;
        }
    }.bind( this ) );
    req.end();
};

Page.prototype.fetch = function() {
    this.fullUrl = this.basePath + this.stub + '?page=' + this.page;
    this.fetchPage( this.fullUrl , function( err , data ) {
        var parsedProjects = [];
        if( err ) {
            console.log( 'Error loading (' + this.fullUrl + '): ' + err );
            this.emit( 'pageProjectsLoaded' , parsedProjects );
            return;
        }

        this.rawResult = data;

        var doc = jsdom.jsdom( data );
        var window = doc.createWindow();
        var jq = jquery.create( window );

        var projectsJq = jq( 'li.project' );
        projectsJq.each( function( index , item ) {
            var project = {};

            project.seen = (new Date()).getTime();

            var projectLink = jq( 'h2 a' , item );
            if( projectLink.length ) {
                project.url = projectLink.prop( 'href' );
                project.name = projectLink.text();

                if( 'https' === project.url.substr( 0 , 5 ) ) {
                    project.url = 'http' + project.url.substr( 5 );
                }

                if( project.url.substr( 0 , projectPrefix.length ) === projectPrefix ) {
                    var str = project.url;

                    // Strip off the prefix
                    str = str.substr( projectPrefix.length );

                    // Strip out query parameters
                    if( -1 !== str.indexOf( '?' ) ) {
                        str = str.substr( 0 , str.indexOf( '?' ) );
                    }

                    // Split on the first slash
                    str = str.split( '/' )[0];

                    project.creatorId = str;
                }
            }

            var authorSpan = jq( 'h2 span' , item );
            if( authorSpan.length ) {
                var author = authorSpan.text();
                author = author.replace( /^\s+/ , '' );
                author = author.replace( /\s+$/ , '' );
                author = author.replace( /\n/ , ' ' );
                author = author.replace( /\s+/ , ' ' );
                if( /^by /.test( author ) ) {
                    author = author.replace( /^by / , '' );
                    project.creatorName = author;
                }
            }

            var projectPhoto = jq( '.projectphoto-little' , item );
            if( projectPhoto.length && projectPhoto.prop( 'src' ) ) {
                project.thumbnail = projectPhoto.prop( 'src' );
            }

            if( project.url && project.name && project.thumbnail ) {
                parsedProjects.push( project );
                this.projects.push( project );
            }
        }.bind( this ) );

        this.emit( 'pageProjectsLoaded' , parsedProjects );
    }.bind( this ) );
};

////////////////////////////////////////////////////////////////////////////////
// Main
////////////////////////////////////////////////////////////////////////////////

var pastData = JSON.parse( fs.readFileSync( dataFile ) );
pastData = pastData || {};
pastData.stubs = pastData.stubs || {};
pastData.projectsByStub = pastData.projectsByStub || {};

var channels = {};
var stub;
for( var stubName in stubs ) {
    (function( stub , stubName ) {
        var page = new Page();
        page.basePath = basePath;
        page.stub = stub;
        page.page = 1;
        page.fetch();
        page.on( 'pageProjectsLoaded', function( projects ) {
            console.log( stub + ' successfully parsed ' + projects.length + ' projects on page ' + page.page );
            if( projects.length && page.page < pageLimit ) {
                page.page += 1;
                page.fetch();
            } else {
                page.emit( 'allPagesLoaded' );
            }
        } );
        page.on( 'allPagesLoaded' , function() {
            console.log( stub + ' successfully parsed ' + page.projects.length + ' projects' );
            channels[stub] = page.projects;
            if( allChannelsLoaded() ) {
                produceXml();
            }
        } );
        channels[stub] = null;
    })( stubs[stubName] , stubName );
}

function allChannelsLoaded() {
    for( var x in channels ) {
        if( null === channels[x] ) {
            return false;
        }
    }

    return true;
}

function escapeXml( str ) {
    // &#....;
    return str.replace( /[^A-Za-z0-9 :;\/\\.?=!$%()*+,@\[\]^_{}"'-]/g, function( m ) {
        return '&#x' + m.charCodeAt(0).toString(16).toUpperCase() + ';';
    } );
}

function projectXml( project ) {
    var d = new Date();
    d.setTime( project.seen );

    var xml = '    <item>\n';
    xml += '      <title>' + escapeXml( project.name ) + '</title>\n';
    xml += '      <guid>' + escapeXml( project.url ) + '</guid>\n';
    xml += '      <link>' + escapeXml( project.url ) + '</link>\n';
    xml += '      <description>' + escapeXml( '<a href="' + escapeXml( project.url ) + '">' + escapeXml( project.name ) + '</a><br /><a href="' + escapeXml( project.url ) + '"><img src="' + escapeXml( project.thumbnail ) + '" />' ) + '</description>\n';
    xml += '      <pubDate>' + escapeXml( d.toString() ) + '</pubDate>\n';
    xml += '    </item>\n';
    return xml;
}

function produceXml() {
    var xml = '<rss version="2.0">\n';
    xml += '  <channel>\n';
    xml += '    <title>KS2RSS</title>\n';
    xml += '    <link>http://www.kickstarter.com</link>\n';
    xml += '    <description></description>\n';

    var stubName;
    var stub;
    var projectIndex;
    var seen;
    var project;
    var newOnes = 0;
    for( stubName in stubs ) {
        stub = stubs[stubName];
        seen = {}; // Reset for each stub

        // Initialize containers/notes if not present
        pastData.stubs[stubName] = stub;
        pastData.projectsByStub[stub] = pastData.projectsByStub[stub] || [];

        // Mark all the past projects as seen and re-add them to the XML
        for( projectIndex = 0 ; projectIndex < pastData.projectsByStub[stub].length ; projectIndex ++ ) {
            project = pastData.projectsByStub[stub][projectIndex];

            // Mark as seen
            seen[ project.url ] = true;

            // Item XML
            xml += projectXml( project );
        }

        for( projectIndex = 0 ; projectIndex < channels[stub].length ; projectIndex ++ ) {
            project = channels[stub][projectIndex];

            // If we've not seen this project before
            if( ! seen[ project.url ] ) {
                // Push the project onto the past list
                pastData.projectsByStub[stub].push( project );

                // Mark it seen
                seen[ project.url ] = true;

                // Item XML
                xml += projectXml( project );

                // Count it
                newOnes += 1;
            }
        }

        // Close XML
    }
    xml += '  </channel>\n';
    xml += '</rss>\n';

    fs.writeFileSync( outFile , xml );
    fs.writeFileSync( dataFile , JSON.stringify( pastData ) );

    console.log( 'New ones: ' + newOnes );
    process.exit(0);
}
