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

var pageLimit = null;
var dataFile = 'projectsSeen5.json';
var outFile = 'ks2rss5.xml';
var testMode = false;
var basePath = 'http://www.kickstarter.com';
var projectPrefix = 'http://www.kickstarter.com/projects/';
var stubs = {
    //'Recommended': '/discover/recommended',
    'Recently Launched': '/discover/recently-launched',
    'Ending Soon': '/discover/ending-soon',
    //'Small Projects': '/discover/small-projects',
    //'Comics (Popular)': '/discover/categories/comics/popular',
    //'Comics (Recommended)': '/discover/categories/comics/recommended',
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

function Loader() {
    this.fetch = this.fetch.bind( this );
    this.fetchPage = this.fetchPage.bind( this );

    this.projects = [];

    events.EventEmitter.call( this );

    return this;
}
sys.inherits( Loader , events.EventEmitter );

Loader.prototype.basePath = null;
Loader.prototype.stub = null;
Loader.prototype.page = 1;
Loader.prototype.rawResult = null;

// url must be fully qualified
// callback( err , data )
Loader.prototype.fetchPage = function( url , callback ) {
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

Loader.prototype.fetch = function() {
    var page = this.page;
    this.fullUrl = this.basePath + this.stub + '?page=' + page;
    this.fetchPage( this.fullUrl , function( err , data ) {
        var parsedProjects = [];
        if( err ) {
            console.log( 'Error loading (' + this.fullUrl + '): ' + err );
            this.emit( 'pageProjectsLoaded' , parsedProjects , page );
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

                // Strip out query parameters
                if( -1 !== project.url.indexOf( '?' ) ) {
                    project.url = project.url.substr( 0 , project.url.indexOf( '?' ) );
                }

                // Convert https to http
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

                // Convert https to http
                if( 'https' === project.thumbnail.substr( 0 , 5 ) ) {
                    project.thumbnail = 'http' + project.thumbnail.substr( 5 );
                }
            }

            project.blurb = jq( '.bbcard_blurb' , item ).text();

            if( project.url && project.name && project.thumbnail ) {
                parsedProjects.push( project );
                this.projects.push( project );
            }
        }.bind( this ) );

        this.emit( 'pageProjectsLoaded' , parsedProjects , page );
    }.bind( this ) );
};

////////////////////////////////////////////////////////////////////////////////
// Main
////////////////////////////////////////////////////////////////////////////////

var pastData;

try {
    pastData = JSON.parse( fs.readFileSync( dataFile ) );
} catch( e ) {
    pastData = {};
}

pastData = pastData || {};
pastData.stubs = pastData.stubs || {};
pastData.projectsByUrl = pastData.projectsByUrl || {};

var channels = {};
var stub;
for( var stubName in stubs ) {
    (function( stub , stubName ) {
        var loader = new Loader();
        loader.basePath = basePath;
        loader.stub = stub;
        loader.page = 1;
        loader.fetch();
        loader.on( 'pageProjectsLoaded', function( projects , pageLoaded ) {
            if( pageLoaded == loader.page ) {
                if( projects.length && ( null === pageLimit || loader.page < pageLimit ) ) {
                    loader.page += 1;
                    loader.fetch();
                } else {
                    loader.emit( 'allPagesLoaded' );
                }
            }
        } );
        loader.on( 'allPagesLoaded' , function() {
            console.log( stub + ' successfully parsed ' + loader.projects.length + ' projects' );
            channels[stub] = loader.projects;
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
    xml += '      <description>' + escapeXml(
        '<a href="' + escapeXml( project.url ) + '"><img src="' + escapeXml( project.thumbnail ) + '" /><br />'
        + '<a href="' + escapeXml( project.url ) + '">' + escapeXml( project.name ) + '</a><br />'
        + 'By ' + escapeXml( project.creatorName ) + '</a><br />'
        + '<br />'
        + escapeXml( project.blurb ) + '<br />'
    ) + '</description>\n';
    xml += '      <pubDate>' + escapeXml( d.toString() ) + '</pubDate>\n';
    xml += '    </item>\n';

    return xml;
}

function produceXml() {
    var newOnes;
    var project;
    var projectIndex;
    var stub;
    var stubName;
    var xml;

    // Start XML
    xml = '<rss version="2.0">\n';
    xml += '  <channel>\n';
    xml += '    <title>KS2RSS</title>\n';
    xml += '    <link>http://www.kickstarter.com</link>\n';
    xml += '    <description></description>\n';

    // Mark all the past projects as seen and re-add them to the XML
    for( projectIndex in pastData.projectsByUrl ) {
        // Item XML
        xml += projectXml( pastData.projectsByUrl[ projectIndex ] );
    }

    // For each stub
    newOnes = 0;
    for( stubName in stubs ) {
        stub = stubs[stubName];

        // Initialize containers/notes if not present
        pastData.stubs[stubName] = stub;

        // For each project for this stub
        for( projectIndex = 0 ; projectIndex < channels[stub].length ; projectIndex ++ ) {
            project = channels[stub][projectIndex];

            // If we've not seen this project before
            if( ! pastData.projectsByUrl[ project.url ] ) {
                console.log( 'New one: ' + project.name.replace( /\n.*/ , '' ).replace( /^\s+/ , '' ).replace( /\s+$/ , '' ) );

                // Push the project onto the past list
                pastData.projectsByUrl[ project.url ] = project;

                // Item XML
                xml += projectXml( project );

                // Count it
                newOnes += 1;
            }
        }
    }

    // Close XML
    xml += '  </channel>\n';
    xml += '</rss>\n';

    // Write results
    fs.writeFileSync( outFile , xml );
    fs.writeFileSync( dataFile , JSON.stringify( pastData , null , '\t' ) );

    // Exit cleanly
    console.log( 'New ones: ' + newOnes );
    process.exit(0);
}
