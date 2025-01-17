# *Spectastiq* v0.8.1
An interactive spectrogram renderer and audio player, optimised for touch devices.

## Usage
*Spectastiq* is available as a web-component, which means that you can include the javascript file in the HTML page where you'd like to use it, and then instantiate it using a custom HTML tag.

```
<script type="module" src="/path/to/spectastiq.js"></script>
<spectastiq-viewer src="/path/to/audio/my-audio-file.wav"></spectastiq-viewer>
```

That's it!  *Spectastiq* will try to fit itself to the parent HTML element of the `<spectastiq-viewer>` tag.

Try [the example](https://hardiesoft.com/spectastiq/):

## Roadmap
- Interpolation of already rendered spectrogram fragments for a smoother interactive experience.
- Support displaying your spectrograms with a logarithmic scale.
- Wasm SIMD support for even faster spectrogram rendering.
- VueJS and React wrappers + examples
- Dispatch life-cycle events to the parent page, for more advanced integrations.

## Known issues
- Okay, I lied when I described how easy *spectastiq* is to use.  It currently relies on an advanced JavaScript feature called `SharedArrayBuffer`, which helps *spectastiq* to use all your computers power to render spectrograms really fast.  `SharedArrayBuffer` requires the integrator to serve up their website using some additional HTTP headers to opt-in to a secure context.  We'll soon support an easier, but slower path which will make embedding *spectastiq* when you don't have control over how your pages are served more seamless.

### Acknowledgements

*Spectastiq* was made with the help of funding from the [Brian Mason](https://brianmasontrust.org/) scientific & technical trust.
