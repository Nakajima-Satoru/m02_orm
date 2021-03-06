/**
 * ==================================================
 * 
 * m02_orm
 * 
 * base.js (OrmBase)
 * 
 * CopyLight: Nakajima-Satoru since 0201/04/16
 * 
 * ==================================================
 */

const ormConnection = require("./connection.js");
const OrmConnectionPooling = require("./connectionPooling.js");
const sync = require("./sync.js");
const OrmCallback = require("./callback.js");
const hash = require("./hash.js");

const OrmBase = function(context, topContext){

    var log=[];
    
    /**
     * check
     * @param {*} callback 
     * @returns 
     */
    this.check=function(callback){
      
        var connectData=context.connection();

        OrmConnectionPooling.set(connectData,function(res){
            callback(res);
        });
    };

    /**
     * query
     * @param {*} sql 
     * @param {*} bind 
     * @param {*} callback 
     * @param {*} option 
     */
    this.query=function(sql,bind,callback,option){
        
        var connection = null;

        if(!option){
            option={};
        }

        var _res={};
        
        var ormCallback = new OrmCallback();

        if(callback){
            ormCallback.then(callback);
        }

        sync([
            function(next){

                var connectData=context.connection();

                if(option.connectionPooling){

                    OrmConnectionPooling.set(connectData,function(res){

                        if(!res.status){

                            if(ormCallback._callbackError){
                                ormCallback._callbackError(res.error);
                            }
            
                            if(ormCallback._callback){
                                ormCallback._callback(res);
                            }
                            return;
                        }

                        connection=res.connection;
                        next();

                    });

                    return;
                }

                var connectionHash=hash("sha256",JSON.stringify(connectData));

                if(topContext){
                    if(topContext.ro){
                        if(topContext.ro.connection){
                            if(Object.keys(topContext.ro.connection).length){
                                connection=topContext.ro.connection[connectionHash];
                                next();
                                return;
                            }
                        }
                        else{
                            topContext.ro.connection={};
                        }        
                    }
                }

                new ormConnection(connectData,function(res){

                    if(!res.status){
                        if(ormCallback._callbackError){
                            ormCallback._callbackError(res.error);
                        }


                        if(ormCallback._callback){
                            ormCallback._callback(res);
                        }
                        return
                    }

                    if(topContext){
                        if(topContext.ro){
                            if(topContext.ro.connection){
                                topContext.ro.connection[connectionHash]=res.connection;
                                connection=res.connection;    
                            }
                        }
                    }
                    else{
                        connection=res.connection;
                    }

                    next();        
                });

            },
            function(next){

                log.push({
                    sql:sql,
                    bind:bind,
                });
                                
                if(connection.sqlType=="mysql"){

                    connection.query(sql,bind,function(error,result){

                        _res={
                            error:error,
                            result:result,
                        };

                        next();
                    });
        
                }
                else if(connection.sqlType=="sqlite3"){
        
                    if(bind){
                        var colum=Object.keys(bind);
                        for(var n=0;n<colum.length;n++){
                            var field=colum[n];
                            var value=bind[field];

                            value=cont._s(value);

                            sql=sql.split(field).join(value);
                        }
                    }


                    connection.serialize(() => {
        
                        var sqlLower = sql.toLowerCase();
        
                        var methodType="";
                        if(sqlLower.indexOf("select")==0){
                            methodType="all";
                        }
                        if(option.methodType){
                            methodType=option.methodType;
                        }
        
                        if(methodType=="all"){
                            connection.all(sql,function(error,result){
                                _res={
                                    error:error,
                                    result:result,
                                };

                                next();
                            });
                        }
                        else if(methodType=="get"){
                            connection.get(sql,function(error,result){
                                _res={
                                    error:error,
                                    result:result,
                                };
        
                                next();
                            });
                        }
                        else if(methodType=="each"){
                            connection.each (sql,function(error,result){
                                _res={
                                    error:error,
                                    result:result,
                                };
        
                                next();
                            });
                        }
                        else{
                            connection.run(sql);
                            _res={
                                error:null,
                                result:true,
                            };
    
                            next();
                        }            
                    });
                }
        
            },
            function(){
                     
                var response = new OrmQueryResponse();

                if(_res.error){
                    response.status=false;
                    response.error=_res.error;
                }
                else{
                    response.status=true;
                    response.result=_res.result;
                }

                if(ormCallback._callback){
                    ormCallback._callback(response);
                }

                if(ormCallback._callbackError){
                    if(response.status==false){
                        ormCallback._callbackError(response.error);
                    }
                }

                if(ormCallback._callbackSuccess){
                    if(response.status==true){
                        ormCallback._callbackSuccess(response.result);
                    }
                }
            },
        ]);

        return ormCallback;
    };

    /**
     * checkSurrogateKey
     * @returns 
     */
    this.checkSurrogateKey=function(){
        
        if(!context.surrogateKey){
            return null;
        }

        return context.surrogateKey;
    };

    /**
     * getSqlType
     * @returns 
     */
    this.getSqlType=function(){
        return context.connection().type;
    };

    /**
     * getLog
     * @returns 
     */
    this.getLog=function(){
        return log;
    }

    /**
     * _s
     * @param {*} string 
     * @returns 
     */
    this._s=function(string){

       if(typeof string!="string"){
           return string;
       }

       string=string.split("\"").join("\\\"");

       return "\""+string+"\"";
    };
};
const OrmQueryResponse=function(){

    this.status=true;

};
module.exports=OrmBase;