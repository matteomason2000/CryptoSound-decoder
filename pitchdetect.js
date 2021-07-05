const AudioContext = window.AudioContext || window.webkitAudioContext

let audioContext, analyser
let floatBuf

const TEMPO = 0.3
const INIZIO_TRASMISSIONE =  90
const SEPARATORE_LETTERA = 88
const NOTE = [ 79, 81, 83, 85 ]

const DEBUG_ELEMENT = document.querySelector('pre')

start()

function start() {
	const constraints = {
		"audio": {
			// echoCancellation: true
		}
	}

	navigator.mediaDevices.getUserMedia(constraints).then(function(audioStream) {
		audioContext = new AudioContext()
		const audioSource = audioContext.createMediaStreamSource(audioStream)
		analyser = audioContext.createAnalyser()
		analyser.fftSize = 2048
		audioSource.connect( analyser )
		floatBuf = new Float32Array( analyser.frequencyBinCount )
		requestAnimationFrame( updatePitch )
	}).catch(function(err) {

	})
}

function noteFromPitch( frequency ) {
	var noteNum = 12 * (Math.log( frequency / 440 )/Math.log(2) );
	return Math.round( noteNum ) + 69;
}

function frequencyFromNoteNumber( note ) {
	return 440 * Math.pow(2,(note-69)/12);
}

function centsOffFromPitch( frequency, note ) {
	return Math.floor( 1200 * Math.log( frequency / frequencyFromNoteNumber( note ))/Math.log(2) );
}

function autoCorrelate( buf, sampleRate ) {
	// Implements the ACF2+ algorithm
	let SIZE = buf.length;
	let rms = 0;

	for (let i=0;i<SIZE;i++) {
		let val = buf[i];
		rms += val*val;
	}
	rms = Math.sqrt(rms/SIZE);
	if (rms<0.01) // not enough signal
		return -1;

	let r1=0, r2=SIZE-1, thres=0.2;
	for (let i=0; i<SIZE/2; i++)
		if (Math.abs(buf[i])<thres) { r1=i; break; }
	for (let i=1; i<SIZE/2; i++)
		if (Math.abs(buf[SIZE-i])<thres) { r2=SIZE-i; break; }

	buf = buf.slice(r1,r2);
	SIZE = buf.length;

	let c = new Array(SIZE).fill(0);
	for (let i=0; i<SIZE; i++)
		for (let j=0; j<SIZE-i; j++)
			c[i] = c[i] + buf[j]*buf[j+i];

	let d=0; while (c[d]>c[d+1]) d++;
	let maxval=-1, maxpos=-1;
	for (let i=d; i<SIZE; i++) {
		if (c[i] > maxval) {
			maxval = c[i];
			maxpos = i;
		}
	}
	let T0 = maxpos;

	let x1=c[T0-1], x2=c[T0], x3=c[T0+1];
	a = (x1 + x3 - 2*x2)/2;
	b = (x3 - x1)/2;
	if (a) T0 = T0 - b/(2*a);

	return sampleRate/T0;
}


let timeSample = 0
const interval = TEMPO * 1000
let accum = new Map() // accumula le note (ogni frame)
let quadString        // accumula la stringa a base 4
let noteCount = -1    // conta le note accumulate (nella stringa)
let output = ""       // stringa che conterra il risultato del messaggio

function updatePitch( time ) {

	let n = -1

	analyser.getFloatTimeDomainData( floatBuf );
	const ac = autoCorrelate( floatBuf, audioContext.sampleRate )

	if (ac == -1) {
		// nota non trovata
	} else {
		const pitch = ac
		n = noteFromPitch( pitch )

		// Quanto è stonata la nota?`
		const detune = centsOffFromPitch( pitch, n )

		if (detune == 0 ) {
			// Per un detect più preciso provare ad assegnare un valore
			// solo con detune == 0...?
		} else if (detune < 0){
		} else {
		}
	}

	// Calcolo dell’intervallo
	const delta = time - timeSample
	if (delta < interval) {
		// Accumuliamo le note
		if (n != -1) {
			if (accum.has(n)) {
				accum.set(n, accum.get(n) + 1)
			} else {
				accum.set(n, 1)
			}
		}
	} else {
		// Abbiamo un TICK
		timeSample = time - delta % interval

		// Cerchiamo le note con maggior "detect count"
		if (accum.size > 0) {
			const max = [...accum.entries()].reduce((a, e ) => e[1] > a[1] ? e : a)
			const nota   = max[0] // che nota
			const count  = max[1] // numero di note detettate

			if (nota == INIZIO_TRASMISSIONE) {
				output = ''
				noteCount = -1
				quadString = ''
				console.log("START")
			} else if (nota == SEPARATORE_LETTERA) {
				noteCount = 0
				quadString = ''
				console.log("SEPARATORE")
			} else {
				// Cerchiamo l'indice della nota nelle note possibili (0-3)
				const i = NOTE.indexOf(nota)
				if (i >= 0) {
					quadString += i
				} else {
					quadString += '0'
				}
				noteCount++
				if (noteCount == 4) {
					noteCount = -1
					const num = parseInt(quadString, 4)
					const char = String.fromCharCode(num)
					output += char
					DEBUG_ELEMENT.innerHTML = output
				}
			}
		}
		accum.clear()
	}
	requestAnimationFrame( updatePitch )
}