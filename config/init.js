/**
 * Created by tinyiko on 2017/03/28.
 */
/**
 * This file initialiazes config data for the dispatch and
 * redis servers. Also used to initialize config data for rabbitMQ
 */
(function(){
    var serverConfig;

    server_config = {
        port: '3000',
        host: 'localhost',
        redis_port: '3001',
        redis_host: 'localhost'
    };

    exports.serverConfig = server_config;
}).call(this);