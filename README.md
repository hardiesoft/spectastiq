# *Spectastiq* v0.10.0
An interactive spectrogram renderer and audio player, optimised for touch devices.

## Usage
*Spectastiq* is available as a web-component, which means that you can include the javascript file in the HTML 
page where you'd like to use it, and then embed it using a custom HTML tag.

```html
<script type="module" src="/path/to/spectastiq.js"></script>
<spectastiq-viewer src="/path/to/audio/my-audio-file.mp3"></spectastiq-viewer>
```

That's it!  *Spectastiq* will fit itself to the parent HTML element of the `<spectastiq-viewer>` tag.

Try [the examples](https://hardiesoft.com/spectastiq/):

## Advanced integrations

You can embed *spectastiq* into your application, and extend it (for example, drawing an overlay showing regions of interest in the audio).

### Custom player UI controls

Replace the default audio player controls with your own using the `player-controls` template slot:
```html
<script type="module" src="/path/to/spectastiq.js"></script>
<spectastiq-viewer src="/path/to/audio/my-audio-file.mp3">
    <div slot="player-controls">
      <button>My custom button</button>
    </div>
</spectastiq-viewer>
```
You can then write your own javascript to handle the actions your new UI elements should take.

### Events dispatched by *spectastiq*

See the `spectastiq.d.ts` file for an overview of events dispatched by spectastiq, as well as functions exposed
for the purpose of extending spectastiq with your own functionality.

## Roadmap
- More advanced interpolation of already rendered spectrogram fragments for a smoother interactive experience.
- Support displaying your spectrograms with a logarithmic scale.
- VueJS and React wrappers + examples
- Unload spectastiq from memory when there are many instances of spectastiq running on a page, and an instance is outside the page viewport.
- Allow other FFT window sizes. (The current default is 2048 samples)

## Known issues
For longer audio clips (more than 1 minute), *spectastiq* can run into issues on low-end mobile devices.  
To best support longer clips, it's necessary to serve *spectastiq* from a "secure context", which means that you need to 
set some headers on the files that your web-server delivers to your users. 
This enables an advanced JavaScript feature called `SharedArrayBuffer`, which helps *spectastiq* to use all your 
computers power to render spectrograms really fast, and also reduces memory usage which seems to otherwise trigger 
browser bugs on resource-constrained mobile devices (Chrome Android on a Lenovo Tab M10 with 3GB RAM triggered this).

## Building the Rust-based WASM FFT component

You don't need to build the WASM FFT processing library to use this component – that's only required if you
want to make changes to how the audio chunks are processed into frequency distribution data.

If you *do* want to make changes:
This project was build with Rust 1.84.0
If you don't already have a Rust toolchain installed you'll need to do so using [rustup](https://rustup.rs/).
Then you'll need [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/) to package things up.

Once you've got those requirements installed, you can run `wasm-pack build --target web`, and the wasm and supporting
files will appear in the `./pkg` folder.

### Acknowledgements

*Spectastiq* was made with the help of funding from the [Brian Mason](https://brianmasontrust.org/) scientific & 
technical trust, and from [The Cacophony Project](https://cacophony.org.nz)
