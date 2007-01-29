const nsIWebProgress = Components.interfaces.nsIWebProgress;
const nsIWebProgressListener = Components.interfaces.nsIWebProgressListener;

function Click(aEvent)
{
  var link = aEvent.target;

  if (link instanceof HTMLAnchorElement && 
      link.target != "" &&
      link.target != "_self" &&
      link.target != "_top") {
    aEvent.stopPropagation();
  }
}

function Activate(aEvent)
{
  var link = aEvent.target;

  if (link instanceof HTMLAnchorElement && 
      link.target != "" &&
      link.target != "_self" &&
      link.target != "_top") {

    // We don't want to open external links in this process: do so in the
    // default browser.
    var ios = Components.classes["@mozilla.org/network/io-service;1"].
      getService(Components.interfaces.nsIIOService);

    var resolvedURI = ios.newURI(link.href, null, null);

    var extps = Components.
      classes["@mozilla.org/uriloader/external-protocol-service;1"].
      getService(Components.interfaces.nsIExternalProtocolService);

    extps.loadURI(resolvedURI, null);
    aEvent.preventDefault();
    aEvent.stopPropagation();
  }
}

function showDevbar() {
if (document.getElementById("devtoolbox").hidden == true) {
	document.getElementById("devtoolbox").hidden = false;
	} else document.getElementById("devtoolbox").hidden = true;
}

function RemoveListener(aEvent) {
  aEvent.target.ownerDocument.removeEventListener("click", Activate, true);
  aEvent.target.ownerDocument.removeEventListener("DOMActivate", Activate, true);
  aEvent.target.ownerDocument.removeEventListener("unload", RemoveListener, false);
}

const listener = {
  /*
  onLocationChange: function olc(aWP, aRequest, aLocation) {
    var myDocument = aWP.DOMWindow.document;

    Components.utils.reportError("contentdoc = " + myDocument.location);

    myDocument.addEventListener("click", Click, true);
    myDocument.addEventListener("DOMActivate", Activate, true);
    myDocument.addEventListener("unload", RemoveListener, false);
  },
  */

  onStateChange: function osc(aWP, aRequest, aStateFlags, aStatus) {
    if (aStateFlags & nsIWebProgressListener.STATE_STOP) {
      Components.utils.reportError("STATE_STOP");
      var myDocument = aWP.DOMWindow.document;
      myDocument.addEventListener("click", Click, true);
      myDocument.addEventListener("DOMActivate", Activate, true);
      myDocument.addEventListener("unload", RemoveListener, false);
    }
  },

  QueryInterface: function qi(aIID) {
    if (aIID.equals(nsIWebProgressListener) ||
        aIID.equals(Components.interfaces.nsISupports) ||
        aIID.equals(Components.interfaces.nsISupportsWeakReference)) {
      return this;
    }
    throw Components.results.NS_ERROR_NO_INTERFACE;
  },
};

// nsIWebProgressListener implementation to monitor activity in the browser.
function WebProgressListener() {
}
WebProgressListener.prototype = {
  _requestsStarted: 0,
  _requestsFinished: 0,

  // We need to advertize that we support weak references.  This is done simply
  // by saying that we QI to nsISupportsWeakReference.  XPConnect will take
  // care of actually implementing that interface on our behalf.
  QueryInterface: function(iid) {
    if (iid.equals(Components.interfaces.nsIWebProgressListener) ||
        iid.equals(Components.interfaces.nsISupportsWeakReference) ||
        iid.equals(Components.interfaces.nsISupports))
      return this;
    
    throw Components.results.NS_ERROR_NO_INTERFACE;
  },

  // This method is called to indicate state changes.
  onStateChange: function(webProgress, request, stateFlags, status) {
    const WPL = Components.interfaces.nsIWebProgressListener;

    var progress = document.getElementById("progress");

    if (stateFlags & WPL.STATE_IS_REQUEST) {
      if (stateFlags & WPL.STATE_START) {
        this._requestsStarted++;
      } else if (stateFlags & WPL.STATE_STOP) {
        this._requestsFinished++;
      }
      if (this._requestsStarted > 1) {
        var value = (100 * this._requestsFinished) / this._requestsStarted;
        progress.setAttribute("mode", "determined");
        progress.setAttribute("value", value + "%");
      }
    }

    if (stateFlags & WPL.STATE_IS_NETWORK) {
      var stop = document.getElementById("stop");
      if (stateFlags & WPL.STATE_START) {
        stop.setAttribute("disabled", false);
        progress.setAttribute("style", "");
      } else if (stateFlags & WPL.STATE_STOP) {
        stop.setAttribute("disabled", true);
        progress.setAttribute("style", "display: none");
        this.onStatusChange(webProgress, request, 0, "Done");
        this._requestsStarted = this._requestsFinished = 0;
      }
    }
  },

  // This method is called to indicate progress changes for the currently
  // loading page.
  onProgressChange: function(webProgress, request, curSelf, maxSelf,
                             curTotal, maxTotal) {
    if (this._requestsStarted == 1) {
      var progress = document.getElementById("progress");
      if (maxSelf == -1) {
        progress.setAttribute("mode", "undetermined");
      } else {
        progress.setAttribute("mode", "determined");
        progress.setAttribute("value", ((100 * curSelf) / maxSelf) + "%");
      }
    }
  },

  // This method is called to indicate a change to the current location.
  onLocationChange: function(webProgress, request, location) {
    var urlbar = document.getElementById("urlbar");
    urlbar.value = location.spec;

    var browser = document.getElementById("mainBrowser");
    var back = document.getElementById("back");
    var forward = document.getElementById("forward");

    back.setAttribute("disabled", !browser.canGoBack);
    forward.setAttribute("disabled", !browser.canGoForward);
  },

  // This method is called to indicate a status changes for the currently
  // loading page.  The message is already formatted for display.
  onStatusChange: function(webProgress, request, status, message) {
    var status = document.getElementById("status");
    status.setAttribute("label", message);
  },

  // This method is called when the security state of the browser changes.
  onSecurityChange: function(webProgress, request, state) {
    const WPL = Components.interfaces.nsIWebProgressListener;

    var sec = document.getElementById("security");

    if (state & WPL.STATE_IS_INSECURE) {
      sec.setAttribute("style", "display: none");
    } else {
      var level = "unknown";
      if (state & WPL.STATE_IS_SECURE) {
        if (state & WPL.STATE_SECURE_HIGH)
          level = "high";
        else if (state & WPL.STATE_SECURE_MED)
          level = "medium";
        else if (state & WPL.STATE_SECURE_LOW)
          level = "low";
      } else if (state & WPL_STATE_IS_BROKEN) {
        level = "mixed";
      }
      sec.setAttribute("label", "Security: " + level);
      sec.setAttribute("style", "");
    }
  }
};
var listener2;

function go() {
  var urlbar = document.getElementById("urlbar");
  var browser = document.getElementById("mainBrowser");
  browser.loadURI(urlbar.value, null, null);
}

function back() {
  var browser = document.getElementById("mainBrowser");
  browser.stop();
  browser.goBack();
}

function forward() {
  var browser = document.getElementById("mainBrowser");
  browser.stop();
  browser.goForward();
}

function reload() {
  var browser = document.getElementById("mainBrowser");
  browser.reload();
}

function stop() {
  var browser = document.getElementById("mainBrowser");
  browser.stop();
}

function showConsole() {
  window.open("chrome://global/content/console.xul", "_blank",
    "chrome,extrachrome,menubar,resizable,scrollbars,status,toolbar");
}

function start()
{
  var dls = Components.classes["@mozilla.org/docloaderservice;1"].
    getService(Components.interfaces.nsIWebProgress);

  listener2 = new WebProgressListener();
	
  dls.addProgressListener(listener,
                          nsIWebProgress.NOTIFY_STATE |
                          nsIWebProgress.NOTIFY_STATE_DOCUMENT);

  var browser = document.getElementById("mainBrowser");
  browser.addProgressListener(listener2,
    Components.interfaces.nsIWebProgress.NOTIFY_ALL);
	
  var prefs = Components.classes["@mozilla.org/preferences-service;1"].
    getService(Components.interfaces.nsIPrefBranch);

  var startURI = prefs.getCharPref("gmzilla.startURI");
  browser.webNavigation.loadURI(startURI, 0, null, null, null);
  
}

function gmz_LoadURL(url)
{
    // Set the browser window's location to the incoming URL
    window._content.document.location = url;

    // Make sure that we get the focus
    window.content.focus();
}