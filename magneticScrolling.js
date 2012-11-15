//polyfill ref:http://paulirish.com/2011/requestanimationframe-for-smart-animating/
(function() {
    var lastTime = 0;
    var vendors = ['ms', 'moz', 'webkit', 'o'];
    for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
        window.cancelAnimationFrame =
          window[vendors[x]+'CancelAnimationFrame'] || window[vendors[x]+'CancelRequestAnimationFrame'];
    }
 
    if (!window.requestAnimationFrame)
        window.requestAnimationFrame = function(callback, element) {
            var currTime = new Date().getTime();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var id = window.setTimeout(function() { callback(currTime + timeToCall); }, 
              timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };
 
    if (!window.cancelAnimationFrame)
        window.cancelAnimationFrame = function(id) {
            window.clearTimeout(id);
        };
}());



/*!
 * iScroll v4.2 ~ Copyright (c) 2012 Matteo Spinelli, http://cubiq.org
 * Released under MIT license, http://cubiq.org/license
 */
 /*
	Modified by Ricardo Freitas to include an api that informs the scroller of how
	much the wrapper is scaled (zoomed)
	The iScroller already takes into account zooming, but only for the case that the
	it was the iScroller itself that scaled the content
 */
(function(window, doc){
var m = Math,
	dummyStyle = doc.createElement('div').style,
	vendor = (function () {
		var vendors = 't,webkitT,MozT,msT,OT'.split(','),
			t,
			i = 0,
			l = vendors.length;

		for ( ; i < l; i++ ) {
			t = vendors[i] + 'ransform';
			if ( t in dummyStyle ) {
				return vendors[i].substr(0, vendors[i].length - 1);
			}
		}

		return false;
	})(),
	cssVendor = vendor ? '-' + vendor.toLowerCase() + '-' : '',

	// Style properties
	transform = prefixStyle('transform'),
	transitionProperty = prefixStyle('transitionProperty'),
	transitionDuration = prefixStyle('transitionDuration'),
	transformOrigin = prefixStyle('transformOrigin'),
	transitionTimingFunction = prefixStyle('transitionTimingFunction'),
	transitionDelay = prefixStyle('transitionDelay'),

    // Browser capabilities
	isAndroid = (/android/gi).test(navigator.appVersion),
	isIDevice = (/iphone|ipad/gi).test(navigator.appVersion),
	isTouchPad = (/hp-tablet/gi).test(navigator.appVersion),

    has3d = prefixStyle('perspective') in dummyStyle,
    hasTouch = 'ontouchstart' in window && !isTouchPad,
    hasTransform = !!vendor,
    hasTransitionEnd = prefixStyle('transition') in dummyStyle,

	RESIZE_EV = 'onorientationchange' in window ? 'orientationchange' : 'resize',
	START_EV = hasTouch ? 'touchstart' : 'mousedown',
	MOVE_EV = hasTouch ? 'touchmove' : 'mousemove',
	END_EV = hasTouch ? 'touchend' : 'mouseup',
	CANCEL_EV = hasTouch ? 'touchcancel' : 'mouseleave',
	WHEEL_EV = vendor == 'Moz' ? 'DOMMouseScroll' : 'mousewheel',
	TRNEND_EV = (function () {
		if ( vendor === false ) return false;

		var transitionEnd = {
				''			: 'transitionend',
				'webkit'	: 'webkitTransitionEnd',
				'Moz'		: 'transitionend',
				'O'			: 'oTransitionEnd',
				'ms'		: 'MSTransitionEnd'
			};

		return transitionEnd[vendor];
	})(),

	nextFrame = (function() {
		return window.requestAnimationFrame ||
			window.webkitRequestAnimationFrame ||
			window.mozRequestAnimationFrame ||
			window.oRequestAnimationFrame ||
			window.msRequestAnimationFrame ||
			function(callback) { return setTimeout(callback, 1); };
	})(),
	cancelFrame = (function () {
		return window.cancelRequestAnimationFrame ||
			window.webkitCancelAnimationFrame ||
			window.webkitCancelRequestAnimationFrame ||
			window.mozCancelRequestAnimationFrame ||
			window.oCancelRequestAnimationFrame ||
			window.msCancelRequestAnimationFrame ||
			window.clearTimeout;
	})(),

	// Helpers
	translateZ = has3d ? ' translateZ(0)' : '';

	function prefixStyle (style) {
		if ( vendor === '' ) return style;

		style = style.charAt(0).toUpperCase() + style.substr(1);
		return vendor + style;
	}


	var constructor =
	window.mScroll = function(el){
		el = $(el);

		this.previousPoint = null;
		this.magneticContainerClass = "magneticContainerClass";


		// Default options
		this.options = {
			hScroll: true,
			vScroll: true,
			x: 0,
			y: 0,
			bounce: true,
			bounceLock: false,
			momentum: true,
			lockDirection: true,
			useTransform: true,
			useTransition: true,//much smoother
			topOffset: 0,
			checkDOMChanges: false,		// Experimental
			handleClick: true,

			// Scrollbar
			hScrollbar: true,
			vScrollbar: true,
			fixedScrollbar: isAndroid,
			hideScrollbar: isIDevice,
			fadeScrollbar: isIDevice && has3d,
			scrollbarClass: '',

			// Zoom
			zoom: false,
			zoomMin: 1,
			zoomMax: 4,
			doubleTapZoom: 2,
			wheelAction: 'scroll',

			// Scale (or zooming outside of the control of the iScroll)
			scaleX: 1,
			scaleY: 1,

			// Snap
			snap: false,
			snapThreshold: 1,

			// Events
			onRefresh: null,
			onBeforeScrollStart: function (e) { e.preventDefault(); },
			onScrollStart: null,
			onBeforeScrollMove: null,
			onScrollMove: null,
			onBeforeScrollEnd: null,
			onScrollEnd: null,
			onTouchEnd: null,
			onDestroy: null,
			onZoomStart: null,
			onZoom: null,
			onZoomEnd: null
		};


		this.getPoint = function(e){
			e = hasTouch ? e.touches[0] : e;
			//console.log(e);
			return { x: e.pageX, y: e.pageY };
		};

		function equal_points(point1, point2){
			if ( point1.x === point2.x && point2.y === point2.y)
				return true;
			return false;
		}

		this.start = function(e){
			var current_point = this.getPoint(e);
			this.point = current_point;
			this.timeStamp = e.timeStamp ;

			//what if it's momentum mode and the user rest his finger but does not move it,
			//how do you check to see if the finger should stop the momentum?
			var checkIfStaticTime = 100;
			var startedMoving = false;

			$(e.target).one( MOVE_EV, function(){
				startedMoving = true;
			});

			window.setTimeout( function(){
				if (!that.startedMoving){
					that.stopDeacceleration();
					console.log("DEACCELERATION");
					that.deacceleration = 90;
				}
			}, checkIfStaticTime);
		};

		function sign(number){
			//ref: http://stackoverflow.com/questions/7624920/number-sign-in-javascript
			return number > 0 ? 1 : number == 0 ? 0 : -1;
		}

		function sameSign( delta1, delta2 ){
			delta1 = sign(delta1);
			delta2 = sign(delta2);
			if ( delta1 === delta2 ) return true;
			return false;
		}
		

		this.delta = function(point1, point2){
			return {
				x: (point2.x - point1.x)*this.options.scaleX,
				y: (point2.y - point1.y)*this.options.scaleY
			};
		};


		this.move = function(e){
			var current_point = this.getPoint(e);

			console.log(current_point);
			var	delta = this.delta( this.point, current_point );
			var elapsedTime = e.timeStamp - this.timeStamp;
			var	newY = this.y + delta.y;

			var current_velocity = delta.y/elapsedTime;

			this.point = current_point;//input point
			
			if ( this.givingMomentum && sameSign(current_velocity, this.velocity) && Math.abs(current_velocity) > Math.abs(this.velocity) ){
				this.startDeacceleration(e);
			}else{
				this.pos( 0, newY);
				this.stopDeacceleration();
			}

			console.log( elapsedTime );

			this.timeStamp = e.timeStamp;

			this.velocity = current_velocity;
			console.log("velocity:"+this.velocity);

			
		};

	
		this.momentumAnimation = function(){
			if ( !this.givingMomentum) return;

			var final_time = 2000;

			var currentTime = new Date().getTime();
			var elapsedTime = currentTime - this.momentumAnimationTimeStart ;

			var sign = 1;
			if ( sameSign( this.momentumAnimationVelocityStart, this.deacceleration ) ){
				sign = -1;
			}
			else{
				sign = 1;
			}

			console.log(this.deacceleration);
			var new_velocity = this.momentumAnimationVelocityStart + sign*this.deacceleration*elapsedTime;

			var new_position = {
				x:0,
				y: this.momentumAnimationPositionStart.y + this.momentumAnimationVelocityStart*elapsedTime + (sign/2)*this.deacceleration*elapsedTime*elapsedTime
			};

			if ( sameSign( this.momentumAnimationVelocityStart, new_velocity  ) ){
				window.requestAnimationFrame(function(){
					that.momentumAnimation();
				});

				this.velocity = new_velocity;
				/*
				console.log("elapsedTime"+elapsedTime);
				console.log("this.momentumAnimationVelocityStart"+this.momentumAnimationVelocityStart);
				console.log("animating in this bitch");
				console.log("velocity:"+this.velocity);
				console.log("increment:"+new_position.y);
				*/
				this.pos( 0, new_position.y  );
			}
			else{
				this.stopDeacceleration();
				return;
			}
		};


		this.startDeacceleration = function(e){
			this.stopDeacceleration();

			this.givingMomentum = true;

			this.deacceleration = 0.002;

			this.momentumAnimationTimeStart = e.timeStamp;
			this.momentumAnimationVelocityStart = this.velocity;
			this.momentumAnimationPositionStart = { x:this.x, y:this.y};

			this.momentumAnimationId = window.requestAnimationFrame( function(){
				that.momentumAnimation();
			} );
		};

		this.stopDeacceleration = function(){
			if (this.givingMomentum){
				window.cancelAnimationFrame(this.momentumAnimationId);
				this.givingMomentum = false;
				this.velocity = 0;
			}
		};

		this.end = function(e){
			console.log("ENDING");

			var current_point = this.getPoint(e);
			var elapsedTime = e.timeStamp - this.timeStamp;
			var delta = this.delta( this.point , current_point);
			//this.velocity = delta.y/elapsedTime;

			var nullVelocityMinimum = 0.5;

			if ( Math.abs(this.velocity) >  nullVelocityMinimum){
				this.startDeacceleration(e);
				return;
			}

			console.log("end point:"+this.getPoint(e).y);

			//check upper boundary
			if (this.scrollingElement.position().top > 0){
				this.pos(0,0, 200);
			}
			else {
				var parentHeight = this.scrollingElement.parent().height();
				var height = this.scrollingElement.height();
				if ( this.scrollingElement.position().top + height < parentHeight ){
					if (height < parentHeight){
						this.pos(0,0, 200);
					}
					else{
						this.pos(0, parentHeight - height, 200);
					}
				}
			}
		};
		

		this.pos = function(x,y, duration){

			//x = this.hScroll ? x : 0;
			//y = this.vScroll ? y : 0;

			var scrollerStyle = this.scrollingElement[0].style;

			if (duration){
				scrollerStyle[transitionDuration] = duration+"ms";
				scrollerStyle[transitionTimingFunction] = 'cubic-bezier(0.33,0.66,0.66,1)';
			}
			else if( scrollerStyle[transitionDuration] ){
				scrollerStyle[transitionDuration] = "0";
			}

			if (this.options.useTransform) {
				scrollerStyle[transform] = 'translate(' + x + 'px,' + y + 'px) ' + translateZ ;
			} else {
				x = m.round(x);
				y = m.round(y);
				this.scrollingElement.css( "left" , x + 'px');
				this.scrollingElement.css( "top" , y + 'px');
			}

			this.x = x;
			this.y = y;
		};

		this.incrementPos = function(xInc, yInc, duration){
			return this.pos( this.x + xInc, this.y + yInc, duration );
		};

		var that = this;
		//event handlers
		// these can't be changed by a client for a good reason,
		//since their purpose is to set and unset other handlers
		//and call the functions that matter for each event
		var startHandler = function(e){
			that.start(e);

			el.on( MOVE_EV, moveHandler);
			el.on ( CANCEL_EV + " "+ END_EV, endHandler);

			that.scrollingElement[0].style[transitionDuration] = "0ms";
		};
		var moveHandler = function(e){
			that.move(e);
		};
		var endHandler = function(e){
			el.off( MOVE_EV, moveHandler );
			el.off( CANCEL_EV + " "+ END_EV, endHandler );
			that.end(e);
		};

		//initializing the event handlers
		el.on( START_EV, startHandler);
		



		this.x = 0;
		this.y = 0;

		this.scrollingElement = el.children(":first");

		return this;
	};


})(window, document);