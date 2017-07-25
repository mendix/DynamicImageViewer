define([
    "dojo/_base/declare",
    "mxui/widget/_WidgetBase",
    "dijit/_TemplatedMixin",
    "dojo/dom-class",
    "dojo/dom-style",
    "dojo/_base/lang",
    "dojo/on"
], function (declare, _WidgetBase, _TemplatedMixin, domClass, domStyle, lang, on) {
    return declare("DynamicImage.widget.DynamicImage", [_WidgetBase], {

        _contextObj: null,
        _clickHandler: null,

        widthNumber: null,
        heightNumber: null,

        postMixInProperties: function () {
            // Hack around: Mendix widget will add width and height attribute to image node
            // <img height="50" width="50">
            // Rename the properties in the XML will break backward compatibility.
            // Also html template could not be used.
            this.widthNumber = this.width;
            delete this.width;
            this.heightNumber = this.height;
            delete this.height;
        },

        buildRendering: function() {
            var image = document.createElement("img");
            this.imageNode = image;
            this.domNode = image;
            this.setImageSize(false);
        },

        update: function (obj, callback) {
            logger.debug(this.id + ".update");
            this._contextObj = obj;
            if (obj !== null) {
                this._resetSubscriptions();
                this._updateRendering(callback);
            } else if (this.mxcontext && this.mxcontext.getTrackId()){
                mx.data.get({
                   guid    : this.mxcontext.getTrackId(),
                   callback : lang.hitch(this, function(obj) {
                       this._contextObj = obj;
                       this._updateRendering(callback);
                   }),
                   error: lang.hitch(this, function (err) {
                       console.warn(this.id + ".update mx.data.get failed");
                       this._executeCallback(callback, "update mx.data.get errorCb");
                   })
               }, this);
            } else {
                this._updateRendering(callback);
            }
        },

        uninitialize: function () {
            logger.debug(this.id + ".uninitialize");
            this.unsubscribeAll();
            if (this._clickHandler) {
                this._clickHandler.remove();
                this._clickHandler = null;
            }
        },

        _updateRendering: function (callback) {
            logger.debug(this.id + "._updateRendering");

            var targetObj,
                loaded = false;

            if (this._contextObj !== null) {
                try {
                    if (this.imageattr !== "") {
                        if (this.imageattr.indexOf("/") === -1) {
                            loaded = this._loadImagefromUrl(this._contextObj.get(this.imageattr));
                        } else {
                            targetObj = this._contextObj.get(this.imageattr.split("/")[0]);
                            if (/\d+/.test(targetObj)) { //guid only
                                loaded = true;
                                this._setToDefaultImage();
                                mx.data.get({ //fetch the object first
                                    guid : targetObj,
                                    nocache : true,
                                    callback : lang.hitch(this, function(obj) {
                                        this._loadImagefromUrl(obj.get(this.imageattr.split("/")[2]));
                                    })
                                }, this);
                            } else if (targetObj !== null) {
                                loaded = this._loadImagefromUrl(targetObj.attributes[ this.imageattr.split("/")[2]].value);
                            }
                        }
                    }
                    if (this._clickHandler === null) {
                        this._clickHandler = on(this.imageNode, "click", lang.hitch(this, this._execClick));
                    }
                } catch (err) {
                    console.warn(this.id +".setDataobject: error while loading image" + err);
                    loaded = false;
                }
            } else {
                console.warn(this.id + ".setDataobject: received null object");
            }

            if (!loaded) {
                this._setToDefaultImage();
            }

            this._executeCallback(callback, "_updateRendering");
        },

        _loadImagefromUrl : function(url) {
            logger.debug(this.id + "._loadImagefromUrl");

            if (url !== "" && typeof url !== "undefined" && url !== null) {
                this.imageNode.onerror = lang.hitch(this, this._setToDefaultImage);
                // Some cases the height was rendering 0px
                // With style (width: 200px; height: 20%) with context object url
                // So, set the relative style after loading.
                this.imageNode.onload = lang.hitch(this, function() {
                    if (this.imageNode) {
                        this.setImageSize(true);
                    }
                });
                this.imageNode.src = this.pathprefix + url + this.pathpostfix;
                if (this.tooltipattr) {
                    this.imageNode.title = this._contextObj.get(this.tooltipattr);
                }
                this._setClickClass();
                return true;
            }
            return false;
        },

        setImageSize: function(relative) {
            logger.debug(this.id + "._resizeImage");
            // No width / height is browser default, equal to css auto
            var width = ""; 
            if (this.widthUnit === "pixels") {
                width = this.widthNumber + "px";
            } else if(this.widthUnit === "percentage" && relative) {
                width = this.widthNumber + "%";
            }
            domStyle.set(this.imageNode, "width", width);

            var height= "";
            if (this.heightUnit === "pixels") {
                height = this.heightNumber + "px";
            } else if(this.heightUnit === "percentage" && relative) {
                height = this.heightNumber + "%";
            }
            domStyle.set(this.imageNode, "height", height);
        },

        _setToDefaultImage : function() {
            logger.debug(this.id + "._setToDefaultImage");
            if (this.imageNode) {
                this.imageNode.onerror = null;  //do not catch exceptions when loading default
                this.imageNode.src = this.defaultImage;
                this._setClickClass();
            }
        },

        _execClick : function(index) {
            logger.debug(this.id + "._execClick");
            if (this._contextObj !== null && this.imageNode) {
                if (this.clickmicroflow !== "") {
                    mx.ui.action(this.clickmicroflow, {
                        params          : {
                            applyto     : "selection",
                            guids       : [this._contextObj.getGuid()]
                        },
                        error           : function(error) {
                            console.error(this.id + "error: XAS error executing microflow");
                        }
                    }, this);
                }
                if (this.linkattr !== "") {
                    var url = this._contextObj.get(this.linkattr);
                    if (url !== "" && url !== undefined && url !== null) {
                        window.open(url, this.linktarget);
                    }
                }
            }
        },

        _setClickClass: function () {
            domClass.toggle(this.imageNode, "dynamicimage-clickable", this.clickmicroflow !== "" || this.linkattr !== "");
        },

        _resetSubscriptions: function () {
            logger.debug(this.id + "._resetSubscriptions");
            this.unsubscribeAll();

            if (this._contextObj) {
                this.subscribe({
                    guid: this._contextObj.getGuid(),
                    callback: lang.hitch(this, function (guid) {
                        this._updateRendering();
                    })
                });
            }
        },

        _executeCallback: function (cb, from) {
            logger.debug(this.id + "._executeCallback" + (from ? " from " + from : ""));
            if (cb && typeof cb === "function") {
                cb();
            }
        }
    });
});

require(["DynamicImage/widget/DynamicImage"]);
