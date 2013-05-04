var fetchPage = require( './lib/fetch' ).fetchPage;
var parseProjectListPage = require( './lib/parseProjectListPage' ).parseProjectListPage;

var url = 'http://www.kickstarter.com/discover/recently-launched?ref=sidebar';
//var url = 'http://www.kickstarter.com/discover/recently-launched?ref=sidebar&page=%%PAGE%%';

fetchPage({
    url: url,
    maxAttempts: 1,
    extCallback: function( err , body ) {
        if( !err ) {
            var projects = parseProjectListPage( url , body );
            console.log( projects );
        }
    },
});
