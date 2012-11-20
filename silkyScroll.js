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
 //other scrolling references: http://yuilibrary.com/yui/docs/scrollview/
 // http://joehewitt.github.com/scrollability/tableview.html https://github.com/joehewitt/scrollability
 // scrollability user css keyframes which have a bigger overhead, though its friction formula is much close the iOS one
 //friction discussions: http://gamedev.stackexchange.com/questions/20905/simple-speed-deceleration-with-variable-time-step
 // fixing iOS scrolling:
 //  https://github.com/joelambert/ScrollFix
 //  http://stackoverflow.com/questions/2890361/disable-scrolling-in-an-iphone-web-application
 //  scrollability has it fixed as well
 // bezier curves, good for smoothness:
 //  http://www.gamedev.net/topic/351308-cubic-bezier-curve-tangent/
 //  http://cubic-bezier.com/
 //  todo make function like: var bezier-value = function( currentVelocity, acceleration, duration)
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
	CANCEL_EV = hasTouch ? 'touchcancel' : '',
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
	window.silky = function(el, frame){
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

		function equalPoints(point1, point2){
			if ( point1.x === point2.x && point2.y === point2.y)
				return true;
			return false;
		}

		this.start = function(e){
			e.preventDefault();

			var current_point = this.getPoint(e);
			this.point = current_point;
			this.timeStamp = e.timeStamp ;

			this.started = true;

			//what if it's momentum mode and the user rest his finger but does not move it,
			//how do you check to see if the finger should stop the momentum?
			
			var startedMoving = false;
			$(e.target).one( MOVE_EV, function(){
				startedMoving = true;
				if (!ended){
					this.onScrollingStart();
				}
			});
			var ended = false;
			$(e.target).one( END_EV, function(){
				ended = true;
			});

			var checkIfStaticTime = 50;
			window.setTimeout( function(){
				if (!startedMoving && !ended){
					that.stopDeacceleration();
					console.log("STOPPING");
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
			if (!this.started){
				return;
			}
			var current_point = this.getPoint(e);

			console.log(current_point);
			var	delta = this.delta( this.point, current_point );
			var elapsedTime = e.timeStamp - this.timeStamp;
			var	newY = this.y + delta.y;

			var current_velocity = delta.y/elapsedTime;

			this.point = current_point;//input point

			this.timeStamp = e.timeStamp;

			this.velocity = current_velocity;
			
			if ( this.givingMomentum && sameSign(current_velocity, this.velocity) && Math.abs(current_velocity) > Math.abs(this.velocity) ){
				this.startDeacceleration(e);
			}else{
				this.pos( 0, newY);
				this.stopDeacceleration();
			}

			console.log( elapsedTime );

			
			console.log("velocity:"+this.velocity);

			
		};


		var optPow = function(a,power){
			//not sure if it's necessary to optimize, it doesn't even show up
			//on the chrome profiler, running with a macbook pro
			return Math.pow(a,power);
		};


		this.bouncingBack = function(){

		};
	
		this.momentumAnimation = function(){
			if ( !this.givingMomentum) return;

			this.momentumAnimationStep +=1;

			var currentTime = new Date().getTime();
			var elapsedTime = currentTime - this.momentumAnimationTimeStart ;

			//If the frame rate is slow the animation will seem choppy
			//one way to solve this is to update the scroller position
			//with a CSS transition and the time of the transition should be
			//equal or less to the time between the current frame and the next
			//therefore it's necessary to have a prediction model
			//in this case the average of time in between frames divided by 2 is being used
			//TODO remove outliers! which can be very common, since this function is not called
			//when the tab is not viewable

			var smoothness = (elapsedTime/this.momentumAnimationStep);

			var new_velocity;

			//iterative is frame rate independent, but can also be more taxing in computation

			//assumes that time between frames is constant
			//this can be a problem for low end devices, but it is fastest way
			//v(t) = v(t-1)*K'  , the K' is for a constant dt
			//var new_velocity = this.velocity*0.9;//this creates a hidh order hiperbole, meaning in the rate/deacceleration decreases
			
			//iOS version, or at least the closest one
			//version that does not assume a constant frame rate
			//non recursive formula: v(t) = Vo*K^(t/dt)
			//recusive formula v(t) = Vt-1*K^(1/dt)
				//var friction = Math.pow(0.6,1/smoothness);//very cpu taxing
				//console.log("friction:"+friction);

				//new_velocity = this.velocity*friction;

				//non recursive version
				//conclusion, does not seem too slow on an i5
				//use memoazition!

				//new_velocity = this.momentumAnimationVelocityStart*Math.pow(0.9987,elapsedTime);

				//using memoazition!
				//it actually turned out to be recursive in the end, but frame rate independent as well
				//no compromise, the cake was made and eaten
				var previous_elapsedTime = this.timeStamp - this.momentumAnimationTimeStart;
				//it can still have more memoazition, the pow calculation can still be saved and are bound
				//to repeat themselves over time
				//console.log(elapsedTime - previous_elapsedTime);
				new_velocity = this.velocity*optPow(0.9987,elapsedTime-previous_elapsedTime);

			/*
			iterative non exponetial velocity function
			try to approximate using the hiperbole function
			f = k/(x+a)
			for x=0 -> Vo = k/a, assume a = 1 -> k = -Vo
			conclusion: too slow to reach a stop at the end and too fast to slow down in the begining
			*/
			//new_velocity = this.momentumAnimationVelocityStart/((elapsedTime/10)+1);
			
			//use taylor series to approximate it
			
			if (this.momentumAnimationBouncingBack && new_position.y < 0){
				var elastic = 0.9;
				var max_displacement = this.velocity/elastic;
				var boundary_initial_velocity = this.velocity;
				var boundary_initial_time = currentTime;

				this.momentumAnimationBouncingBack = true;

				//needs a better transition

				var elapsedTime  = currentTime - boundary_initial_time;

				new_position = max_displacement*Math.cos( elastic*elapsedTime );
			}
			

			if ( Math.abs(new_velocity) > 0.01 ){
				window.requestAnimationFrame(function(){
					that.momentumAnimation();
				});

				elapsedTime = currentTime - this.timeStamp;

				
				//this.pos( 0, new_position.y , smoothness );

				this.incrementPos( 0, new_velocity*elapsedTime, 0);

				//update to new values
				this.velocity = new_velocity;
				this.timeStamp = currentTime;
			}
			else{
				this.stopDeacceleration();
				return;
			}
		};


		this.startDeacceleration = function(e){
			this.stopDeacceleration();

			this.givingMomentum = true;

			this.momentumAnimationStep = 0;

			this.momentumAnimationTimeStart = e.timeStamp;
			this.momentumAnimationVelocityStart = this.velocity*0.8;
			this.velocity = this.velocity*0.8;

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
				this.onScrollingStop();
			}
		};

		this.onScrollingStart = function(){

		};

		this.onScrollingStop = function(){

		};

		this.end = function(e){
			if (!this.started){
				return false;
			}

			this.started = false;

			console.log("ENDING");

			var current_point = this.getPoint(e);
			//the end point might be different than the previous end point,
			//but might be the same as well

			//lifting the finger at the end of giving momentum might take time,
			//even if the contact point is the same, therefore needs to be some way
			//to account for it, hence the following tolerance
			//from a couple of experiments in a macbook using chrome, the average is of 15ms
			//but 100ms is a safer bet and one that still wouldn't turn off the user
			var toleranceFromMoveToEnd = 100;//ms

			var elapsedTime = e.timeStamp - this.timeStamp;

			console.log("elapsedTime:"+elapsedTime);
			console.log("delta:"+(current_point.y-this.point.y));
			
			if (equalPoints( current_point, this.point )  && elapsedTime > toleranceFromMoveToEnd){
				this.velocity = 0;
				this.timeStamp = e.timeStamp;
			}
			else if (!equalPoints( current_point, this.point )){
				var delta = this.delta( this.point , current_point);
				//makes it less abrupt without considering the final velocity provided by the end event (considering the end velocity creates one which just seems exagerated)
				//however, this might introduce a bug, sometimes when giving momentim the animatio goes
				//to a stop even though momentim is being given by the user, this might
				//happen if for example move is not called and therefore goes directly from start to end
				//in that circustance velocity is not calculated
				//so a way to circumvent that is to make the velocity is not 0
				if ( this.velocity == 0){
					this.velocity = delta.y/elapsedTime;
					this.timeStamp = e.timeStamp;
				}
			}
			
			console.log("velocity:"+this.velocity);


			var nullVelocityMinimum = 0.5;

			if ( Math.abs(this.velocity) >  nullVelocityMinimum){
				this.startDeacceleration(e);
				return;
			}
			else{
				this.stopDeacceleration(e);
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
		var target = $(window.document);
		//event handlers
		// these can't be changed by a client for a good reason,
		//since their purpose is to set and unset other handlers
		//and call the functions that matter for each event
		var startHandler = function(e){
			that.start(e);
			target.on( MOVE_EV, moveHandler);
			target.on ( CANCEL_EV + " "+ END_EV, endHandler);
		};
		var moveHandler = function(e){
			that.move(e);
		};
		var endHandler = function(e){
			target.off( MOVE_EV, moveHandler );
			target.off( CANCEL_EV + " "+ END_EV, endHandler );
			that.end(e);
		};

		//initializing the event handlers
		$(frame).on( START_EV, startHandler);
		//el.on( MOVE_EV, moveHandler );
		//el.on ( CANCEL_EV + " "+ END_EV, endHandler);
		



		this.x = 0;
		this.y = 0;

		this.scrollingElement = el;

		return this;
	};


})(window, document);