/**
 * Created by tinyiko on 2017/05/13.
 */
var logger = require('tracer').colorConsole(
    {
        format : [
            "{{timestamp}} <{{title}}> {{message}} (in {{file}}:{{line}})", //default format
            {
                error : "{{timestamp}} <{{title}}> {{message}} (in {{file}}:{{line}})\nCall Stack:\n{{stack}}" // error format
            }
        ],
        dateformat : "HH:MM:ss.L",
        preprocess :  function(data){
            data.title = data.title.toUpperCase();
        }
    });

exports.logger = logger;