var fs = require( 'fs' );
var dataFile = 'projectsSeen5.json';
var pastData = JSON.parse( fs.readFileSync( dataFile ) );

var count;
var iterator;
count = 0;
for( iterator in pastData.projectsByUrl ) {
    count += 1;
}
console.log( 'Projects seen: ' + count );
