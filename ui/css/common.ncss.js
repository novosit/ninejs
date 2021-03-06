define(['ninejs/css', 'ninejs/config'], function(style, config) {
var result = {path:"ui/css/common.css",children:[]};
result.data = "\n.njsFloatLeft{float:left !important}.njsHidden{display:none !important}.njsPad10{padding-left:5px;padding-right:5px}.njsTransition750ms{-webkit-transition:left 750ms cubic-bezier(1, 0, 0.3, 0.53) 0," + 
 " opacity 750ms cubic-bezier(1, 0, 0.3, 0.53) 0;-moz-transition:left 750ms cubic-bezier(1, 0, 0.3, 0.53) 0, opacity 750ms cubic-bezier(1, 0, 0.3, 0.53) 0;-o-transition:left 750ms cubic-bezier(1, 0, 0.3" + 
 ", 0.53) 0, opacity 750ms cubic-bezier(1, 0, 0.3, 0.53) 0;-ms-transition:left 750ms cubic-bezier(1, 0, 0.3, 0.53) 0, opacity 750ms cubic-bezier(1, 0, 0.3, 0.53) 0;transition:left 750ms cubic-bezier(1, " + 
 "0, 0.3, 0.53) 0, opacity 750ms cubic-bezier(1, 0, 0.3, 0.53) 0;position:absolute;display:none;opacity:0;-ms-filter:\"progid:DXImageTransform.Microsoft.Alpha(Opacity=0)\";filter:alpha(opacity=0)}.njsTr" + 
 "ansitionPanelContainer{overflow:hidden;width:100%;position:relative;}.njsTransitionPanelContainer >.njsTransitionActive{left:0 !important;opacity:1;-ms-filter:none;filter:none;display:block;}.njsTrans" + 
 "itionPanelContainer >.njsTransitionActive.njsTransitionLeft{left:-100%}.njsTransitionPanelContainer >.njsTransitionActive.njsTransitionRight{left:100%}.njsTransitionPanelContainer >.njsTransitionRight" + 
 "{left:100%}.njsTransitionPanelContainer >.njsTransitionLeft{left:-100%}.njsTransitionPanelContainer >.njsTransitionNext{display:block;position:absolute;top:0;width:100%;left:100%;}.njsTransitionPanelC" + 
 "ontainer >.njsTransitionNext.njsTransitionLeft{left:0}.njsTransitionPanelContainer >.njsTransitionPrev{display:block;position:absolute;top:0;width:100%;left:-100%;}.njsTransitionPanelContainer >.njsTr" + 
 "ansitionPrev.njsTransitionRight{left:0}.njsWaiting>:not(*.njsWaitNode){display:none}.njsWaiting .njsWaitNode{width:100% !important;height:100% !important;display:block !important;opacity:1 !important;" + 
 "-ms-filter:none !important;filter:none !important;position:absolute;background-repeat:no-repeat}.cursor-pointer{cursor:pointer}.njsRequiredBox{-webkit-box-shadow:0 0 5px 5px rgba(255,0,0,0.54) !import" + 
 "ant;box-shadow:0 0 5px 5px rgba(255,0,0,0.54) !important}.no-padding{padding:0 !important}"; 
if (config.default.applicationUrl) { result.path = config.default.applicationUrl + result.path; }

return style.style(result);
});