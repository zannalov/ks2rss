exports.PAGE_LIMIT = null; // Max pages to load per stub
exports.PAGES_IN_TANDEM = 5; // Remember, multiply this by the number of stubs below for true number of tandem connections
exports.ATTEMPTS_PER_PAGE = 5;
exports.RETRY_DELAY = 3000;
exports.EXPIRE_THRESHOLD = ( 24 * 60 * 60 * 1000 ); // Milliseconds
exports.DATA_FILE = 'projectsSeen5.json';
exports.OUT_FILE = 'ks2rss5.xml';
exports.TEST_MODE = false;
exports.BASE_PATH = 'http://www.kickstarter.com';
exports.PROJECT_PREFIX = 'http://www.kickstarter.com/projects/';
exports.STUBS = {
    'Recently Launched': '/discover/recently-launched',
    'Ending Soon': '/discover/ending-soon',
    //'Recommended': '/discover/recommended',
    //'Small Projects': '/discover/small-projects',
    //'Comics (Popular)': '/discover/categories/comics/popular',
    //'Comics (Recommended)': '/discover/categories/comics/recommended',
    //'Product Design (Popular)': '/discover/categories/product%20design/popular',
    //'Product Design (Recommended)': '/discover/categories/product%20design/recommended',
    //'Animation (Popular)': '/discover/categories/animation/popular',
    //'Animation (Recommended)': '/discover/categories/animation/recommended',
    //'Short Film (Popular)': '/discover/categories/short%20film/popular',
    //'Short Film (Recommended)': '/discover/categories/short%20film/recommended',
    //'Web Series (Popular)': '/discover/categories/webseries/popular',
    //'Web Series (Recommended)': '/discover/categories/webseries/recommended',
    //'Video Games (Popular)': '/discover/categories/video%20games/popular',
    //'Video Games (Recommended)': '/discover/categories/video%20games/recommended',
    //'Electronic Music (Popular)': '/discover/categories/electronic%20music/popular',
    //'Electronic Music (Recommended)': '/discover/categories/electronic%20music/recommended',
    //'Indie Rock (Popular)': '/discover/categories/indie%20rock/popular',
    //'Indie Rock (Recommended)': '/discover/categories/indie%20rock/recommended',
    //'Pop (Popular)': '/discover/categories/pop/popular',
    //'Pop (Recommended)': '/discover/categories/pop/recommended',
    //'Fiction (Popular)': '/discover/categories/fiction/popular',
    //'Fiction (Recommended)': '/discover/categories/fiction/recommended',
    //'Technology Hardware (Popular)': '/discover/categories/hardware/popular',
    //'Technology Hardware (Recommended)': '/discover/categories/hardware/recommended',
    //'Open Software (Popular)': '/discover/categories/open%20software/popular',
    //'Open Software (Recommended)': '/discover/categories/open%20software/recommended',
};

if( exports.TEST_MODE ) {
    exports.TEST_LISTEN_PORT = 8000;
    exports.BASE_PATH = 'http://localhost:8000/samples';
    exports.STUBS = {
        'Recommended': '/discover/recommended',
        'Ending Soon': '/discover/ending-soon',
    };
}
