
var path = require('path');
var lrSnippet = require('grunt-contrib-livereload/lib/utils').livereloadSnippet;

var folderMount = function folderMount(connect, point) {
    return connect.static(path.resolve(point));
};

module.exports = function(grunt) {

var target_css = 'public/css',
    target_js  = 'public/js',
    target_img = 'public/images',
    target     = 'public';

  // Project configuration.
  grunt.initConfig({
    jshint:{
      all: ['Gruntfile.js', 'src/**/*.js', 'test/**/*.js']
    },
    concat: {
      dev: {
        src: ['components/hammerjs/dist/hammer.js'],
        dest: 'public/js/components.js'
      }
    },
    'smush-components': {
      options: {
        fileMap: {
          js: 'public/js/x-tag-components.js',
          css: 'public/css/x-tag-components.css'
        }
      }
    },
    bumpup: ['component.json', 'package.json'],

    connect: {
      livereload: {
          options: {
              port: 9001,
              base: target,
              middleware: function(connect, options) {
                  return [lrSnippet, folderMount(connect, options.base)];
              }
          }
      }
    },
    regarde: {
        css: {
            files: [target_css+'/*'],
            tasks: ['livereload']
        },
        images: {
            files:[target_img+'/*'],
            tasks: ['livereload']
        },
        html: {
            files: [target+'/**/*.html'],
            tasks: ['livereload']
        }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-bumpup');
  grunt.loadNpmTasks('grunt-tagrelease');
  grunt.loadNpmTasks('grunt-smush-components');

  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-regarde');
  grunt.loadNpmTasks('grunt-contrib-livereload');

  grunt.registerTask('dev', ['livereload-start','connect', 'regarde']);
  grunt.registerTask('build', ['jshint','smush-components']);
  grunt.registerTask('bump:patch', ['bumpup:patch', 'tagrelease']);

};
