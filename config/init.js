/**
 * Created by tinyiko on 2017/03/28.
 */
/**
 * This file initialiazes config data for the dispatch and
 * redis servers. Also used to initialize config data for rabbitMQ
 */
(function(){
    var server_config;

    server_config = {
        dispatch_port: 3000,
        redis_port: 3245
    };
    console.log("calling self invoked init.js");

    exports.serverConfig = server_config;
}).call(this);