////////////////////////////////////////////////////////////////////////////////
// Notes
////////////////////////////////////////////////////////////////////////////////

//  Two parts:
//      Part 1: Site scraper
//          For each stub
//          For each page
//              If there are still pages, start fetch of next page
//          For each kickstarter (if not seen)
//          Get project page
//          Index
//      Part 2: RSS feed
//          Order by date indexed followed by end date ascending

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

var configFile = 'test.json';
var testMode = true;
var basePath = 'http://www.kickstarter.com';
var projectPrefix = 'http://www.kickstarter.com/projects/';
var stubs = [
    '/discover/recommended',
    '/discover/recently-launched',
    '/discover/ending-soon',
    '/discover/small-projects',
    '/discover/categories/art/popular',
    '/discover/categories/art/recommended',
    '/discover/categories/comics/popular',
    '/discover/categories/comics/recommended',
];

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
                        res.end( err );
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
        stubs = [
            '/discover/ending-soon',
        ];
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
        if( err ) {
            console.log( 'Error loading (' + this.fullUrl + '): ' + err );
            return;
        }

        this.rawResult = data;

        var doc = jsdom.jsdom( data );
        var window = doc.createWindow();
        var jq = jquery.create( window );

        var projectsJq = jq( 'li.project' );
        var parsedProjects = [];
        projectsJq.each( function( index , item ) {
            var project = {};

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

            parsedProjects.push( project );
            this.projects.push( project );
        }.bind( this ) );

        this.emit( 'pageProjectsLoaded' , parsedProjects );
    }.bind( this ) );
};

////////////////////////////////////////////////////////////////////////////////
// Main
////////////////////////////////////////////////////////////////////////////////

var test = new Page();
test.basePath = basePath;
test.stub = stubs[0];
test.page = 1;
test.fetch();
test.on( 'pageProjectsLoaded', function( projects ) {
    if( projects.length ) {
        test.page += 1;
        test.fetch();
    } else {
        test.emit( 'allPagesLoaded' );
    }
} );
test.on( 'allPagesLoaded' , function() {
    console.log( test.projects.length );
} );

/*
<rss version="2.0">
  <channel>
    <title>STUB_TITLE</title>
    <link>STUB_LINK</link>
    <description>STUB_DESCRIPTION</description>
    <item>
      <title>PROJECT_TITLE</title>
      <link>PROJECT_LINK</link>
      <enclosure url="THUMBNAIL_URL" length="BYTES" type="MIME_TYPE"></enclosure>
      <pubDate>DATE</pubDate>
    </item>
    ...
  </channel>
  ...
</rss>
*/
