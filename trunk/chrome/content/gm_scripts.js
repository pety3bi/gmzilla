// Manager NavBox
// ==UserScript==
// @name          GM Scripting
// @description   Script Repository
// @include       http://mail.google.com/*
// ==/UserScript==

//{{{ //Gmail Macros
(function() {

// Constants

const LABEL_PREFIX = "sc_";
const SPECIAL_LABEL_PREFIX = "ds_";
const SELECT_PREFIX = "sl_";

// maps human readable names to div IDs
const SPECIAL_LABELS = {
  "Inbox": "inbox",
  "Starred": "starred",
  "Chats": "chats",
  "Sent Mail": "sent",
  "Drafts": "drafts",
  "All Mail": "all",
  "Spam": "spam",
  "Trash": "trash",
  "Contacts": "cont"
};

// Command Names
const MARK_AS_READ = "rd";
const MARK_AS_UNREAD = "ur";

const ARCHIVE = "rc_^i";
const MOVE_TO_INBOX = "ib";
const ADD_STAR = "st";
const REMOVE_STAR = "xst";

const APPLY_LABEL = "ac_"; // Followed by label name
const REMOVE_LABEL = "rc_"; // Followed by label name

const MOVE_TO_TRASH = "tr";
const DELETE_FOREVER = "dl"; // Only works when in trash and spam views

const REPORT_SPAM = "sp";
const NOT_SPAM = "us";

const HANDLERS_TABLE = {
  69: [ARCHIVE], // E: always archivE (Y's context-dependent behavior is annoying)
  82: [MARK_AS_READ], // R: mark as Read
  86: [MARK_AS_UNREAD], // V: mark as UnRead
  84: [MOVE_TO_TRASH],// T: move to Trash
  68: [MARK_AS_READ, ARCHIVE] // D: Discard
};

const LABEL_ACTIONS = {
  // g: go to label
  71: function(labelName) {
    var labelDiv = getLabelNode(labelName);
    
    var event = unsafeWindow.document.createEvent("MouseEvents");
    
    var eventType = labelName == "Contacts" ? "click" : "mousedown";

    event.initMouseEvent(eventType,
                         true, // can bubble
                         true, // cancellable
                         window,
                         1, // clicks
                         50, 50, // screen coordinates
                         50, 50, // client coordinates
                         false, false, false, false, // control/alt/shift/meta
                         0, // button,
                         labelDiv);
    event.srcElement = labelDiv;
    labelDiv.dispatchEvent(event);
  },
  // l: apply label
  76: function (labelName) {
    // we don't do special labels (there's other commands, like "archive" for
    // that)
    if (labelName in SPECIAL_LABELS) {
      return;
    }
    
    runCommands([APPLY_LABEL + labelName]);
  },
  //~ b: remove label
  66: function (labelName) {
    // we don't do special labels (there's other commands, like "archive" for
    // that)
    if (labelName in SPECIAL_LABELS) {
      return;
    }

    runCommands([REMOVE_LABEL + labelName]);
  }
};

const SELECT_KEY_VALUES = {
  65: ['a','All'],
  78: ['n','None'],
  82: ['r','Read'],
  83: ['s','Starred'],
  84: ['t','Unstarred'],
  85: ['u','Unread']
};

const SELECT_ACTIONS = {
  77: function(selectionName){ //M
      var selectDiv = getNode(SELECT_PREFIX+selectionName);
      fireMouseEvent(selectDiv);
  },
  191: function(selectionName){ //?
    banner.show()
    banner.update(makeHelpTable());
  },
  79: function(selectionName){ //o
    selectDiv = getNode('ec');
    if(getNode("ec")){
      fireMouseEvent(selectDiv);
    }
    if(getNode("ind")){
      fireMouseEvent(getNode("ind"));
    }
  }
}

const BUILTIN_KEYS_HELP = {
    "C*" : "Compose",
    "/" : "Focus searchbox",
    "Q" : "Focus Quick Contacts",
    "J/K" : "Move older/newer conversation",
    "N/P" : "Move previous/next message in conversation",
    //"O" : "Expands/Collapses conversation",
    "U" : "Return to conversation list (inbox or search)",
    "Y" : "Archive/Remove from view",
    "X" : "Select current conversation",
    "S" : "Star a message or conversation",
    "!" : "Report Spam",
    "R*" : "Reply",
    "A*" : "Reply All",
    "F*" : "Forward"
}

const ADDED_KEYS_HELP = {
    "?" : "Displays this help message",
    "T" : "Trash a message or conversation",
    "E" : "Archiv<b>e</b> always/remove from inbox",
    "R" : "Mark as Read a message or conversation",
    "V" : "Mark as Unread a message or conversation",
    "D" : "Discards (Read&Archive) a message or conversation",
    "G+<i>label</i>" : "Go to a <i>label</i> (including inbox/star/trash/etc).",
    "L+<i>label</i>" : "Applies <i>label</i> to conversation(s)",
    "B+<i>label</i>" : "Removes <i>label</i> from conversation(s)",		//~
    "M+<i>key</i>" : "Mark (Select) <b>A</b>: all, <b>N</b>: none, <b>R</b>: read, <b>U</b>: Unread, <b>S</b>: starred, <b>T</b>: Unstarred",
    "O" : "Expands/Collapses all messages in conversation"
}

// Utility functions
function fireMouseEvent(selectDiv){
    var event = unsafeWindow.document.createEvent("MouseEvents");
    var event2 = unsafeWindow.document.createEvent("MouseEvents");
    event.initMouseEvent("mousedown",
                         true, // can bubble
                         true, // cancellable
                         window,
                         1, // clicks
                         50, 50, // screen coordinates
                         50, 50, // client coordinates
                         false, false, false, false, // control/alt/shift/meta
                         0, // button,
                         selectDiv);
    event2.initMouseEvent("mouseup",
                         true, // can bubble
                         true, // cancellable
                         window,
                         1, // clicks
                         50, 50, // screen coordinates
                         50, 50, // client coordinates
                         false, false, false, false, // control/alt/shift/meta
                         0, // button,
                         selectDiv);
    selectDiv.dispatchEvent(event);
    selectDiv.dispatchEvent(event2);
}
function getObjectMethodClosure1(object, method) {
  return function(arg) {
    return object[method](arg); 
  }
}

function makeHelpTable(){
  
    to_ret = '<table style="color: #fff;font-size:12px;"><caption style="font-size:2em;">Available Key Commands</caption><tr><th colspan="2">Standard</th><th colspan="2">Extended</th>';
    base = [];
    added = [];
    for (var i in BUILTIN_KEYS_HELP)
        base.push("<th>"+i+"</th><td>"+BUILTIN_KEYS_HELP[i]+"</td>");
    for (var i in ADDED_KEYS_HELP)
        added.push("<th>"+i+"</th><td>"+ADDED_KEYS_HELP[i]+"</td>");
    for(var i = (base.length - added.length); i > 0; i--)
        added.push('<th></th><td></td>');
    for(var i = (added.length - base.length); i > 0; i--)
        base.push('<th></th><td></td>');
    for(var i = 0; i < base.length; i++)
        to_ret += "<tr>"+base[i]+added[i]+"</tr>";
    to_ret +='<tr><td colspan="4"><i><b>*</b> Hold <b>&lt;Shift&gt;</b> for new window.</i></td></table>';
    return to_ret;
}

// Shorthand
var newNode = getObjectMethodClosure1(unsafeWindow.document, "createElement");
var getNode = getObjectMethodClosure1(unsafeWindow.document, "getElementById");

// Globals

var banner;

var dispatchedActionTimeout = null;
var activeLabelAction = null;
var activeSelectAction = null;
var labels = new Array();
var selectedLabels = new Array();
var labelInput = null;

if (isLoaded()) { 
  banner = new Banner();
  window.addEventListener('keydown', keyHandler, false);
}

function isLoaded() {
  // Action or contacts menus is present
  return (getActionMenu() != null) || (getNode("co") != null);
}

function getActionMenu() {
  const ACTION_MENU_IDS = ["tam", "ctam", "tamu", "ctamu"];

  for (var i = 0, id; id = ACTION_MENU_IDS[i]; i++) {
    if (getNode(id) != null) {
      return getNode(id);
    }
  }

  return null;
}

function keyHandler(event) {
  // Apparently we still see Firefox shortcuts like control-T for a new tab - 
  // checking for modifiers lets us ignore those
  if (event.altKey || event.ctrlKey || event.metaKey || (event.shiftKey && event.keyCode != 191)) {
    return false;
  }
  
  // We also don't want to interfere with regular user typing
  if (event.target && event.target.nodeName) {
    var targetNodeName = event.target.nodeName.toLowerCase();
    if (targetNodeName == "textarea" ||
        (targetNodeName == "input" && event.target.type &&
         event.target.type.toLowerCase() == "text")) {
      return false;
    }
  }

  if (event.keyCode in LABEL_ACTIONS) {
    if (activeLabelAction) {
      endLabelAction();
      return false
    } else {
      activeLabelAction = LABEL_ACTIONS[event.keyCode];
      beginLabelAction();
      return true;
    }
  }

  if (event.keyCode in SELECT_ACTIONS){
    if(event.keyCode == 191 && !event.shiftKey){//trying to search
      GM_log('Select jump!');
      getNode('s').q.focus();
      event.preventDefault();
      return true;
    }
    if (activeSelectAction){
      endSelectAction();
      return false;
    } else {
      activeSelectAction = SELECT_ACTIONS[event.keyCode];
      beginSelectAction();
      return true;
    }
  }

  if (event.keyCode in HANDLERS_TABLE) {
    runCommands(HANDLERS_TABLE[event.keyCode]);
    return true;
  }

  //GM_log("Missed Key Code:"+event.keyCode);
  
  return false;
}

function beginLabelAction() {
  var divs = getNode("nb_0").getElementsByTagName("div");
  labels = new Array();

  for (var i=0; i < divs.length; i++) {
    if (divs[i].className.indexOf("cs") != -1 &&
        divs[i].id.indexOf(LABEL_PREFIX) == 0) {
      labels.push(divs[i].id.substring(LABEL_PREFIX.length));
    }
  }
  
  for (var specialLabel in SPECIAL_LABELS) {
    labels.push(specialLabel);
  }

  banner.show();

  dispatchedActionTimeout = null;

  labelInput = makeLabelInput();
  labelInput.addEventListener("keyup", updateLabelAction, false);
  // we want escape, clicks, etc. to cancel, which seems to be equivalent to the
  // field losing focus
  labelInput.addEventListener("blur", endLabelAction, false);
}

function beginSelectAction(){
  labelInput = makeLabelInput();
  labelInput.addEventListener("keyup", updateSelectAction, false);
  // we want escape, clicks, etc. to cancel, which seems to be equivalent to the
  // field losing focus
  labelInput.addEventListener("blur", endSelectAction, false);
}

function makeLabelInput(){
  labelInput = newNode("input");
  labelInput.type = "text";
  labelInput.setAttribute("autocomplete", "off");
  with (labelInput.style) {
    position = "fixed"; // We need to use fixed positioning since we have ensure
                        // that the input is not scrolled out of view (since
                        // Gecko will scroll for us if it is).
    top = "0";
    left = "-300px";
    width = "200px";
    height = "20px";
    zIndex = "1000";
  }

  unsafeWindow.document.body.appendChild(labelInput);
  labelInput.focus();
  labelInput.value = "";
  return labelInput;
}

function endAction() {
  banner.hide();

  if (labelInput) {
    labelInput.parentNode.removeChild(labelInput);
    labelInput = null;
  }
}

function endLabelAction(){
  endAction();
  activeLabelAction = null;
}

function endSelectAction(){
  endAction();
  activeSelectAction = null;
}

function updateLabelAction(event) {
  // We've already dispatched the action, the user is just typing away
  if (dispatchedActionTimeout) {
    return;
  }
  
  selectedLabels = new Array();
  
  // We need to skip the label shortcut that got us here
  var labelPrefix = labelInput.value.substring(1).toLowerCase();

  banner.update(labelPrefix);
  
  if (labelPrefix.length == 0) {
    return;
  }
  
  for (var i=0; i < labels.length; i++) {
    if (labels[i].toLowerCase().indexOf(labelPrefix) == 0) {
      selectedLabels.push(labels[i]);
    }
  }
  
  if (event.keyCode == 13 || selectedLabels.length == 1) {
    // Tell the user what we picked
    banner.update(selectedLabels[0]);

    // We don't invoke the action straight away, if the user wants to keep 
    // typing and/or admire the banner
    dispatchedActionTimeout = window.setTimeout(
      function () {
        activeLabelAction(selectedLabels[0]);
        endLabelAction();
      }, 400);
  }
}

function updateSelectAction(event) {
  if(event.keyCode == 77 || event.keyCode == 16) return true;
  //GM_log("SELECT Keycode:"+event.keyCode);
  if(event.keyCode in SELECT_KEY_VALUES){
    activeSelectAction(SELECT_KEY_VALUES[event.keyCode][0]);
  }else{
    activeSelectAction();
    //this is for help
    if(event.keyCode == 191 && event.shiftKey) return true;
  }
  endSelectAction();
}


function getLabelNode(labelName) {
  if (labelName in SPECIAL_LABELS) {
    return getNode(SPECIAL_LABEL_PREFIX + SPECIAL_LABELS[labelName]);
  } else {
    return getNode(LABEL_PREFIX + labelName);
  }
}

function runCommands(commands) {
  for (var i=0; i < commands.length; i++) {
    var command = commands[i];
    
    // A one second pause between commands seems to be enough for LAN/broadband
    // connections
    setTimeout(getCommandClosure(commands[i]), 100 + 1000 * i);
  }
}

function getCommandClosure(command) {
  return function() {
    // We create a fake action menu, add our command to it, and then pretend to
    // select something from it. This is easier than dealing with the real
    // action menu, since some commands may be disabled and others may be
    // present as buttons instead
    var actionMenu = newNode("select");
    var commandOption = newNode("option");
    commandOption.value = command;
    commandOption.innerHTML = command;
    actionMenu.appendChild(commandOption);  
    actionMenu.selectedIndex = 0;
    
    var actionMenuNode = getActionMenu();
    
    if (actionMenuNode) {
      var onchangeHandler = actionMenuNode.onchange;
      
      onchangeHandler.apply(actionMenu, null);    
    } else {
      GM_log("Not able to find a 'More Actions...' menu");
      return;
    }    
  }
}

function Banner() {
  this.backgroundNode = getNodeSet();
  this.backgroundNode.style.background = "#000";
  this.backgroundNode.style.MozOpacity = "0.75";
  this.backgroundNode.style.zIndex = 100;
  for (var child = this.backgroundNode.firstChild; 
       child; 
       child = child.nextSibling) {
    child.style.visibility = "hidden";
  }
  
  this.foregroundNode = getNodeSet();
  this.foregroundNode.style.zIndex = 101;
}

function getNodeSet() {
  var boxNode = newNode("div");
  with (boxNode.style) {
    display = "none";
    position = "fixed";
    bottom = "20%";
    left = "10%";
    margin = "0 10% 0 10%";
    width = "60%";
    textAlign = "center";
    MozBorderRadius = "10px";
    padding = "10px";
    color = "#fff";
  }
  
  var messageNode = newNode("div");
  with (messageNode.style) {
    fontSize = "24px";
    fontWeight = "bold";
    fontFamily = "Lucida Grande, Trebuchet MS, sans-serif";
    margin = "0 0 10px 0";
  }
  boxNode.appendChild(messageNode);

  var taglineNode = newNode("div");
  with (taglineNode.style) {
    fontSize = "13px";
    margin = "0";
  }
  taglineNode.innerHTML = 'LabelSelector<span style="color:red">9000</span>';
  boxNode.appendChild(taglineNode);
  
  return boxNode;
}

Banner.prototype.hide = function() {
  this.backgroundNode.style.display = 
    this.foregroundNode.style.display = "none";
}

Banner.prototype.show = function() {
  this.update("");
  document.body.appendChild(this.backgroundNode);
  document.body.appendChild(this.foregroundNode);
  this.backgroundNode.style.display = 
    this.foregroundNode.style.display = "block";
}

Banner.prototype.update = function(message) {
  if (message.length) {
    this.backgroundNode.firstChild.style.display = 
      this.foregroundNode.firstChild.style.display = "inline";
  } else {
    this.backgroundNode.firstChild.style.display = 
      this.foregroundNode.firstChild.style.display = "none";
  }
    this.backgroundNode.firstChild.innerHTML = 
      this.foregroundNode.firstChild.innerHTML = message;
}


})();
//}}}

//{{{ //Smart Read Button
(function() 
{
	function gmrItem(e){
		try{
			if (Debug_Verbose) GM_log("Entering 'gmrItem'...");
			//Since we are no longer passing the button as an argument, 
			//and are instead trapping the button click event, we can get 
			//an insance of the button from it's event 'target' property...
			var gmr_Button = e.target;
			
			//find the command box
			var command_box;

			//We need to get the gmr_Button Native Wrapper...
			//Find which upper gmr Button is visible...
			gmr_Button = getElement('_gmr_Button0');
			GM_log("gmr_Button: " + gmr_Button);
				
			if (gmr_Button){
				//Make sure its OK to mark...
				if (!gmr_Button.wrappedJSObject.disabled) {
					command_box=gmr_Button.wrappedJSObject.parentNode.getElementsByTagName('select')[0];
					command_box.onfocus();			
				}
			}else{
				if (Debug || Debug_Verbose) GM_log("No MR Button found...");
			}

			if (Debug || Debug_Verbose) GM_log('MR Button Clicked.');

			//Get the index for 'Mark Read' (GMR)...
			var gmr_index=-1;
			for (var i=0; i<command_box.options.length; i++) 
			{
				if (('rd'==command_box.options[i].value || 'ur'==command_box.options[i].value) 
					&& !command_box.options[i].disabled ) 
				{
					gmr_index=i;
					break;
				}
			}

			//Abort if 'MTT' is not an available command for the current page...
			if (-1==gmr_index) return;

			//Select the command index for MTT and fire the change event...
			command_box.selectedIndex=gmr_index;
			command_box.onchange();
			
		}catch(e){
			GM_log("[gmrItem]: " + e);
		}	
	}

	function getElement(id) {
		try{
			if (Debug_Verbose) GM_log("Entering 'getElement'...");
			
			var el=window.document.getElementById(id);
			if (el) return el;
			return false;
		}catch(e){
			GM_log("[getElement]: " + e);
		}
	}

	function createDOMButton(id) {
		try{
			if (Debug_Verbose) GM_log("Entering 'createDOMButton'...");
			
			var gmr_Button=window.document.createElement('button');
			gmr_Button.setAttribute('type', 'button');
			gmr_Button.setAttribute('disabled', 'true');
			gmr_Button.setAttribute('class', 'ab');
			gmr_Button.setAttribute('id', '_gmr_Button'+id);
			gmr_Button.innerHTML='Mark Read';
			gmr_Button.addEventListener('click', gmrItem, false);

			return gmr_Button;
		}catch(e){
			GM_log("[createDOMButton]: " + e);
		}
	}

	function insertButton(insert_container, id) {
		try{
			if (Debug_Verbose) GM_log("Entering 'insertButton'...");

			if (!insert_container) return false;
			if (getElement('_gmr_Button'+id)) {
				return false;
			}

			var Insert_Point = -1;
			
			//Create a spacer object...
			//spacer=insert_container.childNodes[1].cloneNode(false);
			spacer=document.createTextNode(" ");
			//spacer=insert_container.childNodes[insert_container.childNodes.length-4].cloneNode(false);
			
			//Locate the 'select' dropdown...
			for(index = 0; index < insert_container.childNodes.length; index++){
				if (Debug_Verbose) GM_log("Child Node " + index + ": " + insert_container.childNodes[index].nodeName);
				if (insert_container.childNodes[index].nodeName=="SELECT"){
					Insert_Point=index;	
				}
			}
			
			if (Insert_Point==-1) return false;

			var gmr_Button=createDOMButton(id);
			var spacer;

			//Insert buttons & spacers...
			
			//Set the insertion point immediately after the select dropdown...
			insert_container.insertBefore(spacer, insert_container.childNodes[Insert_Point]);
				
			//Insert a preceding spacer...
			insert_container.insertBefore(gmr_Button, spacer);
						
			//Add an optional trailing spacer...
			//insert_container.appendChild(spacer);
			

		}catch(e){
			GM_log("[insertButton]: " + e);
		}
	}


	function placeGmrButtons() {
		try{
			if (Debug_Verbose) GM_log("Entering 'placeGmrButtons'...");
			
			//Upper main menu...
			var top_menu=getElement('tam');  
			if (top_menu) {
				insertButton(top_menu.parentNode, 0);
			}else{
				if (Debug_Verbose) GM_log("[placeGmrButtons] Top Main Menu not found...  Skipping Button Insert.");
			}

			//Lower main menu...
			var bot_menu=getElement('bam');  
			if (bot_menu)  {
				insertButton(bot_menu.parentNode, 1);
			}else{
				if (Debug_Verbose) GM_log("[placeGmrButtons] Bottom Main Menu not found...  Skipping Button Insert.");
			}
			
		}catch(e){
			GM_log("[placeGmrButtons]: " + e);
		}
	}

	function validateControls()
	{
		if (Debug_Verbose) GM_log("Entering 'validateControls'...");
			
		try {
			//if (!Validating){
				//Validating=true;
				validateGmrButtons();
				validateCheckBoxes();
				//Validating=false;
			//}				
		} catch(e) {
			GM_log("[validateControls]: " + e);
		} 
	}


	function validateGmrButtons()
	{
		if (Debug_Verbose) GM_log("Entering 'validateGmrButtons'...");
			
		//Catch errors here as this gets called on the timer and may occur while the page is reloading...
		try {
			if (document && !getElement('_gmr_Button0')) {
					placeGmrButtons();
			}	
		} catch(e) {
			GM_log("[validateGmrButtons]: " + e);
		} 

	}


	function validateCheckBoxes() {
		try{
			if (Debug_Verbose) GM_log("Entering 'validateCheckBoxes'...");
			
			//Get the index for 'Mark Read' (GMR)...
			var button_text='Mark Read';
			var command_box=getElement('_gmr_Button0').wrappedJSObject.parentNode.getElementsByTagName('select')[0];
			command_box.onfocus();
			var gmr_index=-1;

			for (var i=0; i<command_box.options.length; i++) 
			{
				if ('rd'==command_box.options[i].value && !command_box.options[i].disabled ) 
				{
					gmr_index=i;
					break;
				}
				if ('ur'==command_box.options[i].value && !command_box.options[i].disabled ) 
				{
					gmr_index=i;
    				button_text='Mark Unread';
					break;
				}
			}

			if (gmr_index > -1)
			{
				modGmrButton(false, button_text);
			} else {
				modGmrButton(true, button_text);
			}
		}catch(e){
			GM_log("[validateCheckBoxes]: " + e);
		}	  	
	}


	function modGmrButton(disable, button_txt){
		try{
			if (Debug_Verbose) GM_log("Entering 'modGmrButton'...");

			//var btnCount=0;

			validateGmrButtons();

			for(index = 0; index < 2; index++)
			{
				if (getElement('_gmr_Button' + index)) 
				{
					//btnCount = btnCount + 1;
					getElement('_gmr_Button' + index).disabled = disable;
					getElement('_gmr_Button' + index).innerHTML = button_txt;
				}
			}
		
			//if (btnCount == 0) placeGmrButtons();
			//document.all["_gmr_Button" + index].disabled = false;

		} catch(e) {
			GM_log("[modGmrButton]: " + e);
		}
	}

	window.ProcessEvent = function ProcessEvent(e){   		
		try{
			if (Debug_Verbose) GM_log("[ProcessEvent]: " + e.target);

			if (!e) var e = window.event;
			var strTarget = e.target;

			if (Debug || Debug_Verbose) GM_log(strTarget +' Event Trapped!');
			
			//Validate...		
			if (validateControls() != undefined) {
				validateControls();
				setTimeout("validateControls()", 500);
				setTimeout("validateControls()", 2000);
				setTimeout("validateControls()", 4000);
				setTimeout("validateControls()", 8000);
				setTimeout("validateControls()", 16000);
			}

			//Let gmail's code run...
			var retval = routeEvent(e);

			if (retval == false) return false;
   			else return true;
		} catch(err) {
			GM_log("[ProcessEvent]: "  + err + strTarget);
		}
	}

	try{
		var Debug=false;
		var Debug_Verbose=false;

		if (Debug || Debug_Verbose) GM_log("Loading script...");
			
		//var Validating=false;
		
		var DocSearch = document.location.search
		if (DocSearch) {
			if (DocSearch.match(/search=drafts/) //Drafts...		
				|| DocSearch.match(/name=htmlcompose/) //Compose...
				|| DocSearch.match(/view=cv/) 
				|| document.location.search.match(/view=page/)
   			) {
				// Kill the event handler...
				window.removeEventListener('click', window.ProcessEvent, false);
				window.removeEventListener('focus', window.ProcessEvent, false);
				window.removeEventListener('blur', window.ProcessEvent, false);
     		} else {
				// Set the event handler...
				if (Debug || Debug_Verbose) GM_log("Attempting to capture events...");
				if (window.captureEvents) {					
					window.addEventListener('click', window.ProcessEvent, false);
					window.addEventListener('focus', window.ProcessEvent, false);
					window.addEventListener('blur', window.ProcessEvent, false);										
				} else {
					if (Debug || Debug_Verbose) GM_log("Unable to capture events...");
				}
				
				//If there are any 'Checked' checkboxes, enable the 'Mark Read' button...
				if (Debug || Debug_Verbose) GM_log("Calling 'validateControls' from Sub Main...");
				if (validateControls() != undefined) validateControls();
			}
		} else {
			if (Debug || Debug_Verbose) GM_log("Unable to search document.location...");
		}
	} catch(e) {
		GM_log("Error in Sub Main: " + e);
	}
})(); //}}}
//{{{ //ForwardReplay Button
function findPosX(obj) {
 var curleft = 0;
 if(obj.offsetParent) {
  while(true) {
   curleft += obj.offsetLeft;
   if(!obj.offsetParent) {
    break;
   }
   obj = obj.offsetParent;
  } 
 } else if(obj.x) {
  curleft += obj.x;
 }
 return curleft;
}

function findPosY(obj) {
 var curtop = 0;
 if(obj.offsetParent) {
  while(true) {
   curtop += obj.offsetTop;
   if(!obj.offsetParent) {
    break;
   }
   obj = obj.offsetParent;
  }
 } else if(obj.y) {
  curtop += obj.y;
 }
 return curtop;
}

function getLastElement(type, id) {
 var lastElement = document.getElementById(id);
 var elements = document.getElementsByTagName(type);
 for (i=0; i < elements.length; i++) {
  if (elements[i].id.indexOf(id) == 0) {
   if (findPosY(elements[i]) > findPosY(lastElement)) {
    lastElement = elements[i];
   }
  }
 }
 return lastElement;
}

function fire(targetType,targetId) {
  fireOnThis = getLastElement(targetType,targetId);
  if (fireOnThis != null) {
    var newX = findPosX(fireOnThis);
    var newY = findPosY(fireOnThis);
    var evObj = document.createEvent('MouseEvents');
    evObj.initMouseEvent("mousedown",true,true,document.defaultView,Event.CLICK, newX, newY, 0, 0, false, false, false, false, 0, null);
    fireOnThis.dispatchEvent(evObj);
  }
}

function reply(recursive) {
 if (recursive) {
  forward(false);
 }
 fire("td","sm_2");
}

function forward(recursive) {
 if (recursive) {
  reply(false);
 }
 fire("td","sm_4");
}

function createBut(label, func) {
 var butt = document.createElement('BUTTON');
 butt.className = "ab";
 butt.addEventListener('click',func,false)
 var buttext = document.createTextNode(label);
 butt.appendChild(buttext);
 return butt;
}

var span = document.getElementById("bk");
if (span != null) {
var divs = document.getElementsByTagName("div");
for (i=0; i < divs.length; i++) {
 if (divs[i].className.indexOf("tbcb") == 0) {
  divs[i].appendChild(createBut("Reply",reply));
  divs[i].appendChild(createBut("Forward",forward));
 }
}
}
//}}}

var readerFrameNode = null;
var feedsContainerNode = null;
var hiddenNodes = [];

const GMAIL_STYLES = [
  "#reader-frame {",
  "  width: 100%;",
  "  border: 0;",
  "}",
  
  ".reader-embedded #ft {",
    "display: none",
  "}",
  
  // Make currently selected item appear normal
  ".reader-embedded table.cv * {",
  "  background: #fff;",
  "  font-weight: normal",
  "}",
  
  // Make the feeds link appear selected
  ".reader-embedded #feeds-container {",
  "  background: #c3d9ff;",
  "  -moz-border-radius: 5px 0 0 5px;",
  "  font-weight: bold;",
  "  color: #00c;",
  "}",
].join("\n");

const READER_STYLES = [
  "body {",
  "  background: #fff",  
  "}",
  
  "#nav,",
  "#logo-container,",
  "#global-info,",
  "#viewer-header {",
  "  display: none !important;",
  "}",
  "",
  "#main {",
  "  margin-top: 0;",
  "}",
  "",
  "#chrome {",
  "  margin-left: 0;",
  "}"
].join("\n");

const READER_UNREAD_COUNT_URL = 
  "http://www.google.com/reader/api/0/unread-count?" +
  "all=true&output=json&client=gm";

const READER_LIST_VIEW_URL =
  "http://www.google.com/reader/view/user/-/state/com.google/reading-list?" +
  "gmail-embed=true&view=list";

if (document.location.hostname == "mail.google.com") {
  injectGmail();
} else if (document.location.hostname == "www.google.com" &&
           document.location.search.indexOf("gmail-embed") != -1) {
  injectReader();
}           

function injectGmail() {
  if (!getNode("nds") || !getNode("ds_inbox")) return;
  
  GM_addStyle(GMAIL_STYLES);
  
  var feedsNode = newNode("span");
  feedsNode.className = "lk";
  feedsNode.innerHTML = 
      'Feeds ' +
      '<span id="reader-unread-count"></span>';
  feedsNode.onclick = showReaderFrame;
  
  feedsContainerNode = newNode("div");
  feedsContainerNode.className = "nl";
  feedsContainerNode.id = "feeds-container";
  feedsContainerNode.appendChild(feedsNode);
  
  var navNode = getNode("nds");
  
  navNode.insertBefore(feedsContainerNode, navNode.childNodes[2]);
  
  window.addEventListener("resize", resizeReaderFrame, false);
  
  updateUnreadCount();
  
  window.setInterval(updateUnreadCount, 5 * 60 * 1000); 
  
  window.setInterval(checkFeedsParent, 1000);
}

function checkFeedsParent() {
  var navNode = getNode("nds");
  
  if (feedsContainerNode.parentNode != navNode) {
    navNode.insertBefore(feedsContainerNode, navNode.childNodes[2]);
  }  
}

function updateUnreadCount() {
/*  var unreadCountNode = getNode("reader-unread-count");
  
  if (!unreadCountNode) return;
  
  GM_xmlhttpRequest({
    method: "GET",
    url: READER_UNREAD_COUNT_URL,
    onload: function(details) {
      var data = eval("(" + details.responseText + ")");
      var isUnread = false;
      
      for (var i = 0, unreadCountPair; 
           unreadCountPair = data.unreadcounts[i]; 
           i++) {
        if (unreadCountPair.id.indexOf("reading-list") != -1) {
          var count = unreadCountPair.count;
          if (count == 0) break;
          
          unreadCountNode.innerHTML = 
              " (" + count + (count == data.max ? "+" : "") + ") ";
          isUnread = true;
          break;
        }
      }
      
      if (!isUnread) {
        unreadCountNode.innerHTML = "";
      }
    }
  });*/
}

function resizeReaderFrame() {
  if (!readerFrameNode) return;
  
  readerFrameNode.style.height = 
      (window.innerHeight - readerFrameNode.offsetTop) + "px";  
}

function showReaderFrame(event) {
  var container = getNode("co");
  
  addClass(document.body, "reader-embedded");
  
  hiddenNodes = [];
  
  for (var i = container.firstChild; i; i = i.nextSibling) {
    hiddenNodes.push(i);
    i.style.display = "none";
  }
  
  readerFrameNode = newNode("iframe");
  readerFrameNode.src = READER_LIST_VIEW_URL;
  readerFrameNode.id = "reader-frame";
  
  container.appendChild(readerFrameNode);
  
  container.parentNode.style.paddingRight = "0";
  container.parentNode.style.paddingBottom = "0";
  
  resizeReaderFrame();
  
  // Make clicks outside the content area hide it  
  getNode("nav").addEventListener("click", hideReaderFrame, false);
  
  // Since we're in a child of the "nav" element, the above handler will get
  // triggered immediately unless we stop this event from propagating
  event.stopPropagation();  
  
  return false;
}

function hideReaderFrame() {
  var container = getNode("co");

  container.removeChild(readerFrameNode);    
  readerFrameNode = null;
  
  for (var i=0; i < hiddenNodes.length; i++) {
    hiddenNodes[i].style.display = "";
  }
  getNode("nav").removeEventListener("click", hideReaderFrame, false);  
                                     
  removeClass(document.body, "reader-embedded");      
  
  container.parentNode.style.paddingRight = "1ex";
  container.parentNode.style.paddingBottom = "1ex";
  
  return true;
}

function injectReader() {
  GM_addStyle(READER_STYLES);  
}

// Shorthand
function newNode(type) {return unsafeWindow.document.createElement(type);}
function newText(text) {return unsafeWindow.document.createTextNode(text);}
function getNode(id) {return unsafeWindow.document.getElementById(id);}

function hasClass(node, className) {
  return className in getClassMap(node);
}

function addClass(node, className) {
  if (hasClass(node, className)) return;
  
  node.className += " " + className;
}

function removeClass(node, className) {
  var classMap = getClassMap(node);

  if (!(className in classMap)) return;
  
  delete classMap[className];
  var newClassList = [];
  
  for (var className in classMap) {
    newClassList.push(className);
  }
  
  node.className = newClassList.join(" ");
}

function getClassMap(node) {
  var classMap = {};
  var classNames = node.className.split(/\s+/);
  
  for (var i = 0; i < classNames.length; i++) {
    classMap[classNames[i]] = true;
  }
  
  return classMap;
}


//Toggle Font
// Utility functions
function getObjectMethodClosure(object, method) {
  return function() {
    return object[method].apply(object, arguments);
  }
}

// Shorthand
var newNode = getObjectMethodClosure(document, "createElement");
var getNode = getObjectMethodClosure(document, "getElementById");

// Contants
const MONOSPACE_RULE = ".mb, textarea.tb {font-family: monospace !important;}";
const NORMAL_RULE = ".mb, textarea.tb {}";

const TOGGLE_FONT_IMAGE = "data:image/gif;base64,R0lGODlhEAAQAIABAAAAzP%2F%2" +
   "F%2FyH5BAEAAAEALAAAAAAQABAAAAImjI%2BJwO28wIGG1rjUlFrZvoHJVz0SGXBqymXphU5" +
   "Y17Kg%2BnixKBYAOw%3D%3D";

// Globals
var styleSheet = null;
var currentRule = NORMAL_RULE;

var toggleFontLink = null;

function initializeToggleFont() {
  var linksContainer = getNode("ap");
  
  if (!linksContainer) {
    return;
  }

  toggleFontLink = newNode("div");
  toggleFontLink.className = "ar";
  toggleFontLink.addEventListener("click", toggleMessageBodyFont, false);
  toggleFontLink.innerHTML =
    '<span class="l">' +
      '<img class="ai" width="16" height="16" src="' + TOGGLE_FONT_IMAGE + '">' +
      '<u>Toggle font</u>' +
    '</span>';

  linksContainer.appendChild(toggleFontLink);
  
  checkToggleFontParent();
}

function checkToggleFontParent() {
  if (toggleFontLink.parentNode != getNode("ap")) {
    getNode("ap").appendChild(toggleFontLink);
  }
  
  window.setTimeout(checkToggleFontParent, 200);
}

function toggleMessageBodyFont() {
  styleSheet.deleteRule(0);
  if (currentRule == NORMAL_RULE) {
    currentRule = MONOSPACE_RULE;
  } else {
    currentRule = NORMAL_RULE;
  }  
  styleSheet.insertRule(currentRule, 0);
}

function initializeStyles() {
  var styleNode = newNode("style");
  
  document.body.appendChild(styleNode);

  styleSheet = document.styleSheets[document.styleSheets.length - 1];

  styleSheet.insertRule(NORMAL_RULE, 0);    
}

initializeStyles();
initializeToggleFont();

//remove ads
divtags=document.getElementsByTagName("DIV"); // get all div tags
// look for div tag with classname = rh

for ( i = 0; i < divtags.length; i++){
	if ( divtags.item(i).className == "rh" ) {
		divitem=divtags.item(i);
		divitem.style.display="none";
	}
	
}
