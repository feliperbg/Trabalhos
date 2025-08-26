package com.example.realtimedatabase

import androidx.appcompat.app.AppCompatActivity
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import java.io.IOException
import android.net.Uri
import android.speech.tts.TextToSpeech
import android.widget.ImageView
import androidx.activity.result.contract.ActivityResultContracts
import java.util.Locale
import androidx.activity.result.PickVisualMediaRequest
import android.Manifest
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
class LeitorInteligenteActivity : AppCompatActivity(), TextToSpeech.OnInitListener {

    // Views
    private lateinit var imageViewCapturada: ImageView
    private lateinit var tvTextoReconhecido: TextView
    private lateinit var btnSelecionarImagem: Button
    private lateinit var btnAbrirCamera: Button
    private lateinit var btnFalar: Button
    private lateinit var btnPausar: Button
    private lateinit var btnRepetir: Button
    private lateinit var btnapagar: Button

    // TextToSpeech
    private lateinit var tts: TextToSpeech
    private var recognizedText: String = ""
    private var isPaused: Boolean = false
    private var lastSpokenText: String = ""

    // URI para armazenar a imagem capturada pela câmera
    private var imageUri: Uri? = null

    // --- ActivityResultLaunchers ---
    private val pickMediaLauncher = registerForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri: Uri? ->
        if (uri != null) {
            imageUri = uri
            imageViewCapturada.setImageURI(imageUri)
            recognizeTextFromImage(imageUri!!)
        } else {
            Toast.makeText(this, "Nenhuma imagem selecionada.", Toast.LENGTH_SHORT).show()
        }
    }

    private val takePictureLauncher = registerForActivityResult(ActivityResultContracts.TakePicture()) { success ->
        if (success) {
            imageUri?.let { uri ->
                imageViewCapturada.setImageURI(uri)
                recognizeTextFromImage(uri)
            }
        } else {
            Toast.makeText(this, "Captura de imagem cancelada.", Toast.LENGTH_SHORT).show()
        }
    }

    private val requestPermissionLauncher = registerForActivityResult(ActivityResultContracts.RequestPermission()) { isGranted: Boolean ->
        if (isGranted) {
            openCamera()
        } else {
            Toast.makeText(this, "Permissão da câmera é necessária para usar este recurso.", Toast.LENGTH_LONG).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_leitor_inteligente)

        // Inicializar Views
        imageViewCapturada = findViewById(R.id.imageViewCapturada)
        tvTextoReconhecido = findViewById(R.id.tvTextoReconhecido)
        btnSelecionarImagem = findViewById(R.id.btnSelecionarImagem)
        btnAbrirCamera = findViewById(R.id.btnAbrirCamera)
        btnFalar = findViewById(R.id.btnFalar)
        btnPausar = findViewById(R.id.btnPausar)
        btnRepetir = findViewById(R.id.btnRepetir)

        // Inicializar TextToSpeech
        tts = TextToSpeech(this, this)

        // --- Listeners dos botões ---
        btnSelecionarImagem.setOnClickListener {
            pickMediaLauncher.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
        }

        btnAbrirCamera.setOnClickListener {
            checkCameraPermissionAndOpenCamera()
        }

        btnFalar.setOnClickListener {
            speakOut(recognizedText)
            btnPausar.text = "Pausar"
            isPaused = false
        }

        btnPausar.setOnClickListener {
            if (isPaused) {
                // Se estiver pausado, retome a reprodução a partir do último texto
                tts.speak(lastSpokenText, TextToSpeech.QUEUE_FLUSH, null, "retomar")
                btnPausar.text = "Pausar"
                isPaused = false
            } else {
                // Se estiver tocando, pause a reprodução
                lastSpokenText = recognizedText
                tts.stop()
                btnPausar.text = "Retomar"
                isPaused = true
            }
        }

        btnRepetir.setOnClickListener {
            tts.speak(recognizedText, TextToSpeech.QUEUE_FLUSH, null, "")
            btnPausar.text = "Pausar"
            isPaused = false
        }
    }

    private fun checkCameraPermissionAndOpenCamera() {
        when {
            ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED -> {
                openCamera()
            }
            shouldShowRequestPermissionRationale(Manifest.permission.CAMERA) -> {
                Toast.makeText(this, "Precisamos da câmera para tirar a foto.", Toast.LENGTH_LONG).show()
                requestPermissionLauncher.launch(Manifest.permission.CAMERA)
            }
            else -> {
                requestPermissionLauncher.launch(Manifest.permission.CAMERA)
            }
        }
    }

    private fun openCamera() {
        try {
            imageUri = FileProvider.getUriForFile(
                this,
                "${applicationContext.packageName}.provider",
                createImageFile()
            )
            imageUri?.let { uri ->
                takePictureLauncher.launch(uri)
            }
        } catch (e: Exception) {
            e.printStackTrace()
            Toast.makeText(this, "Erro ao preparar a câmera. Verifique a configuração do FileProvider.", Toast.LENGTH_LONG).show()
        }
    }

    @Throws(IOException::class)
    private fun createImageFile(): File {
        val timeStamp: String = SimpleDateFormat("yyyyMMdd_HHmmss").format(Date())
        val storageDir: File? = cacheDir
        return File.createTempFile(
            "JPEG_${timeStamp}_",
            ".jpg",
            storageDir
        )
    }

    private fun recognizeTextFromImage(imageUri: Uri) {
        try {
            val image = InputImage.fromFilePath(this, imageUri)
            val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

            tvTextoReconhecido.text = "Reconhecendo texto..."

            recognizer.process(image)
                .addOnSuccessListener { visionText ->
                    recognizedText = visionText.text
                    tvTextoReconhecido.text = if (recognizedText.isNotEmpty()) recognizedText else "Nenhum texto encontrado."
                    btnFalar.isEnabled = recognizedText.isNotEmpty()
                    btnPausar.isEnabled = recognizedText.isNotEmpty()
                    btnRepetir.isEnabled = recognizedText.isNotEmpty()
                }
                .addOnFailureListener { e ->
                    tvTextoReconhecido.text = "Erro ao reconhecer o texto: ${e.message}"
                    Toast.makeText(this, "Erro ao reconhecer o texto.", Toast.LENGTH_SHORT).show()
                }
        } catch (e: IOException) {
            e.printStackTrace()
            Toast.makeText(this, "Erro ao carregar a imagem.", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            val result = tts.setLanguage(Locale("pt", "BR"))
            if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                Toast.makeText(this, "Linguagem não suportada para Text-to-Speech.", Toast.LENGTH_SHORT).show()
            }
        } else {
            Toast.makeText(this, "Falha na inicialização do Text-to-Speech.", Toast.LENGTH_SHORT).show()
        }
    }

    private fun speakOut(text: String) {
        if (text.isNotEmpty()) {
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "")
        }
    }

    override fun onDestroy() {
        if (::tts.isInitialized) {
            tts.stop()
            tts.shutdown()
        }
        super.onDestroy()
    }
}