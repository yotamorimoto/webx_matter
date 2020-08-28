// references
// https://tonejs.github.io/
// https://threejs.org/
// http://jamie-wong.com/2016/08/05/webgl-fluid-simulation/
// https://paveldogreat.github.io/WebGL-Fluid-Simulation/
// based on
// https://experiments.withgoogle.com/chrome/gpu-simple-fluid-simulation

(function(global, THREE) {

    function FboPingPong(width, height, type) {
        this.readBufferIndex = 0;
        this.writeBufferIndex = 1;
        this.buffers = [
            this.createBuffer(width, height, type),
            this.createBuffer(width, height, type)
        ];
    }

    FboPingPong.prototype = {

        getReadBuffer : function() {
            return this.buffers[this.readBufferIndex];
        },

        getWriteBuffer : function() {
            return this.buffers[this.writeBufferIndex];
        },

        swap : function() {
            var tmp = this.buffers[this.writeBufferIndex];
            this.buffers[this.writeBufferIndex] = this.buffers[this.readBufferIndex];
            this.buffers[this.readBufferIndex] = tmp;
        },

        createBuffer : function(width, height, type) {
            return new THREE.WebGLRenderTarget(width, height, {
                wrapS: THREE.RepeatWrapping,//RepeatWrapping, MirroredRepeatWrapping, ClampToEdgeWrapping
                wrapT: THREE.ClampToEdgeWrapping,
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
                format: THREE.RGBAFormat,
                type: type,
                stencilBuffer: false
            });
        }

    };

    var app, App = function(id) {
        app = this;
        app.init(id);
    };

    // ---------------------------------------------------------------------- App prototype
    App.prototype = {
      // ---------------------------------------------------------------------- init()
      init : function(id) {
          var $dom = $("#" + id);

          var scene = new THREE.Scene();
          var camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.001, 1000);
          camera.position.z = 25;

          var renderer = new THREE.WebGLRenderer({ alpha: true });
          renderer.setClearColor(0xffffff);
          renderer.setSize(window.innerWidth, window.innerHeight);
          $dom.append(renderer.domElement);

          var sceneRTT = new THREE.Scene();
          var cameraRTT = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
          var quadRTT = new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2), null);
          sceneRTT.add(quadRTT);

          var size = 128;

          // THREE.FloatType is not supported on iOS8.3
          var fboVelocityPP = new FboPingPong(size, size, THREE.HalfFloatType);
          var fboPressurePP = new FboPingPong(size, size, THREE.HalfFloatType);
          var fboDivergence = this.getRenderTarget(size, size, THREE.HalfFloatType);

          var advection;
          var divergence;
          var jacobi;
          var subtractPressureGradient;

          var planeSize = 80;
          var plane = new THREE.Mesh(
            new THREE.PlaneBufferGeometry(planeSize, planeSize, size, size),
            new THREE.MeshBasicMaterial({ color: 0xffffff })
          );
          plane.rotation.x = -0.2;

          // ---------------------------------------------------------------------- tone
          var blockSize = 1024;
          // var input = new Tone.UserMedia();
          // input.open();
          var mute1 = new Tone.Player({
            url: "mute1.wav",
            fadeIn: 0.01,
            fadeOut: 0.1,
            retrigger: true,
            loop: false
          });
          var mute2 = new Tone.Player({
            url: "mute2.wav",
            fadeIn: 0.01,
            fadeOut: 0.1,
            retrigger: true,
            loop: false
          });
          var pluck = new Tone.Player({
            url: "pluck.wav",
            fadeIn: 0.01,
            fadeOut: 0.1,
            retrigger: true,
            loop: false
          });
          var una1 = new Tone.Player({
            url: "una1.wav",
            fadeIn: 0.01,
            fadeOut: 0.1,
            retrigger: true,
            loop: false
          });
          var una2 = new Tone.Player({
            url: "una2.wav",
            fadeIn: 0.01,
            fadeOut: 0.1,
            retrigger: true,
            loop: false
          });
          var una3 = new Tone.Player({
            url: "una3.wav",
            fadeIn: 0.01,
            fadeOut: 0.1,
            retrigger: true,
            loop: false
          });
          var vn = new Tone.Player({
            url: "vn.wav",
            fadeIn: 0.1,
            fadeOut: 1,
            retrigger: true,
            loop: false
          });
          var water1 = new Tone.Player({
            url: "water1.wav",
            fadeIn: 0.1,
            fadeOut: 0.1,
            retrigger: false,
            loop: false
          });
          var water2 = new Tone.Player({
            url: "water2.wav",
            fadeIn: 0.1,
            fadeOut: 0.1,
            retrigger: false,
            loop: false
          });
          var notes = [mute1,mute2,pluck,una1,una2,una3];
          // plain web audio api
          var analyser = Tone.context.createAnalyser();
          analyser.fftSize = blockSize;

          mute1.chain(analyser, Tone.Master);
          mute2.chain(analyser, Tone.Master);
          pluck.chain(analyser, Tone.Master);
          una1.chain(analyser, Tone.Master);
          una2.chain(analyser, Tone.Master);
          una3.chain(analyser, Tone.Master);
          vn.chain(analyser, Tone.Master);
          water1.chain(analyser, Tone.Master);
          water2.chain(analyser, Tone.Master);
          // input.connect(analyser);
          var buffer = new Uint8Array(blockSize);
          // var posX = 0;
          // var posY = 0.5;
          // function play(){ tone.start(0); posX = Math.random(); posY = Math.random() }
          var rndX = 0, rndY = 0;
          var flag1 = [true,true,true,true,true,true];
          var loop1 = new Tone.Loop(function(time) {
            loop1.interval = Math.random()*8+1;
            rndX = Math.random()*100-50;
            rndY = Math.random()*100-50;
            for(let x=0; x<6; x++)flag1[x] = Math.random()>0.9;
            // console.log('notes '+flag1);
            for(let y=0; y<6; y++){
              if(flag1[y])notes[y].start(0);
            }
          }, 0.1).start(0);

          var loop2 = new Tone.Loop(function(time) {
            water1.start(0);
          }, 57).start(3);

          var loop3 = new Tone.Loop(function(time) {
            water2.start(0);
          }, 31).start(30);

          var loop4 = new Tone.Loop(function(time) {
            if(Math.random()>0.6)vn.start(0);
          }, 25).start(25);

          // var flip=0;
          // function toggle(){
          //   if(flip%2==0)
          //     Tone.Transport.start();
          //     else
          //     Tone.Transport.stop();
          //   flip++;
          // }
          // window.onclick = toggle;
          // function transportStart(){
          //   // alert('touched');
          //   // Tone.Transport.start();
          //   if(!(Tone.Transport.state=='started')){
          //     // Tone.Transport.start();
          //   }
          // }
          // document.addEventListener('touchstart', transportStart);
          // window.onclick = transportStart;
          // ---------------------------------------------------------------------- tone

          app.loadShader("water.vert", function(vert) {
              app.loadShader("water.frag", function(frag) {
                  plane.material = new THREE.ShaderMaterial({
                      uniforms : {
                          pressure : { value : fboPressurePP.getReadBuffer() }
                      },
                      vertexShader : vert,
                      fragmentShader : frag,
                      wireframe : false,
                      side : THREE.DoubleSide
                  });
              });
          });
          scene.add(plane);

          var blit = function(material, writeBuffer) {
              quadRTT.material = material;
              renderer.render(sceneRTT, cameraRTT, writeBuffer, false);
          };

          // --------------------------------------------------------------------------------- start()
          var start = function(kernel, advection, divergence, jacobi, subtractPressureGradient) {

              var px = { value : new THREE.Vector2(1/size, 1/size) };

              advection = new THREE.ShaderMaterial({
                  uniforms : {
                      velocity : { value : fboVelocityPP.getReadBuffer() },
                      px       : px,
                      mouse    : { value : new THREE.Vector2(0.0, 0.5) },
                      force    : { value : new THREE.Vector2(1, 1) },
                      radius   : { value  : 0.01 }
                  },
                  vertexShader : kernel,
                  fragmentShader : advection
              });

              divergence = new THREE.ShaderMaterial({
                  uniforms : {
                      velocity : { value : fboVelocityPP.getWriteBuffer() },
                      px       : px
                  },
                  vertexShader : kernel,
                  fragmentShader : divergence
              });

              jacobi = new THREE.ShaderMaterial({
                  uniforms : {
                      pressure    : { value : fboPressurePP.getReadBuffer() },
                      divergence  : { value : fboDivergence },
                      px          : px,
                      alpha       : { value : -2 },
                      beta        : { value : 0.25 }
                  },
                  vertexShader : kernel,
                  fragmentShader : jacobi
              });

              subtractPressureGradient = new THREE.ShaderMaterial({
                  uniforms : {
                      pressure    : { value : fboPressurePP.getReadBuffer() },
                      velocity    : { value : fboVelocityPP.getWriteBuffer() },
                      px          : px
                  },
                  vertexShader : kernel,
                  fragmentShader : subtractPressureGradient
              });

              // ---------------------------------------------------------------------- loop
              // camera move
              // var mouseX = 0, mouseY = 0;
              // var updateMousePosition = function(e) {
              //   x = window.innerWidth / 2;
              //   y = window.innerHeight / 2;
              //   mouseX = (e.pageX - x) * 0.1;
              //   mouseY = (e.pageY - y) * 0.1;
              // };

              // wire on/off flicker
              // var flop=0;
              // var updateMousePosition = function(e) {
              //   if(flop%10==0)plane.material.wireframe=true;
              //     else plane.material.wireframe=false;
              //   flop++;
              // };

              // wire on/off manual
              // document.addEventListener('touchstart', wireOn);
              // document.addEventListener('touchend', wireOff);
              // document.addEventListener('mousedown', wireOn);
              // document.addEventListener('mouseup', wireOff);
              // function wireOn(){ plane.material.wireframe =  true };
              // function wireOff(){ plane.material.wireframe =  false };

              var counter = 0;
              (function loop() {
                counter++;
                requestAnimationFrame(loop);
                analyser.getByteTimeDomainData(buffer);

                // camera.position.x += (mouseX - rndX - camera.position.x) * .05;
                // camera.position.y += (-mouseY - rndY - camera.position.y) * .05;
                camera.position.x += (rndX - camera.position.x) * .005;
                camera.position.y += (rndY - camera.position.y) * .005;
                camera.lookAt(scene.position);

                // advection.uniforms.mouse.value = new THREE.Vector2(posX, posY);
                advection.uniforms.force.value = new THREE.Vector2(
                  (buffer[counter%blockSize]-128)*3,
                  (buffer[(counter+32)%blockSize]-128)*3
                );

                blit(advection, fboVelocityPP.getWriteBuffer());
                blit(divergence, fboDivergence);
                for(var i = 0; i < 6; i++) {
                    blit(jacobi, fboPressurePP.getWriteBuffer());
                    fboPressurePP.swap();
                    jacobi.uniforms.pressure.value = fboPressurePP.getReadBuffer();
                }
                blit(subtractPressureGradient, fboVelocityPP.getReadBuffer());
                renderer.render(scene, camera);

              })();
              // ---------------------------------------------------------------------- loop()
          };
          // --------------------------------------------------------------------------------- start()

          this.loadShaders([
              "kernel.vert",
              "advection.frag",
              "divergence.frag",
              "jacobi.frag",
              "subtractPressureGradient.frag",
          ], function(shaders) {
              start(shaders[0], shaders[1], shaders[2], shaders[3], shaders[4]);
          });

          var updateRendererSize = function() {
              var w = window.innerWidth;
              var h = window.innerHeight;
              camera.aspect = w / h;
              camera.updateProjectionMatrix();
              renderer.setSize(w, h);
          };
          $(window).on('resize', updateRendererSize);
      },
      // ---------------------------------------------------------------------- init()
      loadShaders : function(names, success) {
          var req = function(name) {
              var d = $.Deferred();
              app.loadShader(name, function(shader) {
                  d.resolve(shader);
              });
              return d;
          };

          $.when.apply($, names.map(function(name) { return req(name); })).done(function(s1, s2, s3) {
              if(success) success(arguments);
          });
      },
      loadShader: function(name, success) {
          return $.ajax({
              type: "GET",
              url:  name,
              dataType: "text",
              success: function(shader) {
                  if(success) success(shader);
              },
              error: function() {
              }
          });
      },
      getRenderTarget: function(width, height, type) {
          return new THREE.WebGLRenderTarget(width, height, {
              wrapS: THREE.RepeatWrapping,
              wrapT: THREE.RepeatWrapping,
              minFilter: THREE.NearestFilter,
              magFilter: THREE.NearestFilter,
              format: THREE.RGBAFormat,
              type: type,
              stencilBuffer: false
          });
      }
  };
  // ---------------------------------------------------------------------- App prototype
  global.App = App;

})(window, THREE);

$(function() {
    var app = new App("soundmatter");
});
