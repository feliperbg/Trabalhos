import tkinter as tk
from tkinter import filedialog, messagebox
from PIL import Image, ImageTk, ImageDraw
import numpy as np
import cv2


class MetalStructureAnalyzer:
    def __init__(self, root):
        self.root = root
        self.root.title("Analisador de Estruturas Metálicas")

        # Variáveis de estado
        self.image_path = None
        self.image = None
        self.tk_image = None
        self.start_x = None
        self.start_y = None
        self.rect_id = None
        self.selection_rect = None

        # Interface
        self.setup_ui()

    def setup_ui(self):
        self.main_frame = tk.Frame(self.root)
        self.main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        self.canvas = tk.Canvas(self.main_frame, bg='white', cursor="cross")
        self.canvas.pack(fill=tk.BOTH, expand=True)

        self.control_frame = tk.Frame(self.root)
        self.control_frame.pack(fill=tk.X, padx=10, pady=5)

        self.load_btn = tk.Button(self.control_frame, text="Carregar Imagem", command=self.load_image)
        self.load_btn.pack(side=tk.LEFT, padx=5)

        self.analyze_btn = tk.Button(self.control_frame, text="Analisar Seleção",
                                     command=self.analyze_selection, state=tk.DISABLED)
        self.analyze_btn.pack(side=tk.LEFT, padx=5)

        self.reset_btn = tk.Button(self.control_frame, text="Resetar",
                                   command=self.reset, state=tk.DISABLED)
        self.reset_btn.pack(side=tk.LEFT, padx=5)

        self.result_label = tk.Label(self.control_frame, text="Selecione uma área para análise")
        self.result_label.pack(side=tk.LEFT, padx=10)

        # Eventos
        self.canvas.bind("<ButtonPress-1>", self.on_press)
        self.canvas.bind("<B1-Motion>", self.on_drag)
        self.canvas.bind("<ButtonRelease-1>", self.on_release)
        self.canvas.bind("<Configure>", lambda e: self.display_image())  # Redesenhar ao redimensionar

    def load_image(self):
        file_path = filedialog.askopenfilename(filetypes=[("Imagens", "*.jpg *.jpeg *.png *.bmp *.tif *.tiff")])
        if file_path:
            self.image_path = file_path
            try:
                self.image = Image.open(file_path)
                self.display_image()
                self.analyze_btn.config(state=tk.NORMAL)
                self.reset_btn.config(state=tk.NORMAL)
            except Exception as e:
                messagebox.showerror("Erro", f"Não foi possível abrir a imagem:\n{str(e)}")

    def display_image(self):
        if not self.image:
            return

        canvas_width = self.canvas.winfo_width()
        canvas_height = self.canvas.winfo_height()
        if canvas_width <= 1 or canvas_height <= 1:
            return  # Ainda não inicializado

        img_width, img_height = self.image.size
        ratio = min(canvas_width / img_width, canvas_height / img_height)
        new_size = (int(img_width * ratio), int(img_height * ratio))

        resized_image = self.image.resize(new_size, resample=Image.Resampling.LANCZOS)
        self.tk_image = ImageTk.PhotoImage(resized_image)

        self.canvas.delete("all")
        self.canvas.create_image(
            canvas_width // 2,
            canvas_height // 2,
            anchor=tk.CENTER,
            image=self.tk_image
        )

        self.displayed_img_size = new_size
        self.displayed_img_position = (
            (canvas_width - new_size[0]) // 2,
            (canvas_height - new_size[1]) // 2
        )

    def on_press(self, event):
        if not self.image:
            return

        img_x = event.x - self.displayed_img_position[0]
        img_y = event.y - self.displayed_img_position[1]
        if 0 <= img_x < self.displayed_img_size[0] and 0 <= img_y < self.displayed_img_size[1]:
            if self.rect_id:
                self.canvas.delete(self.rect_id)
                self.rect_id = None
            self.start_x = event.x
            self.start_y = event.y
            self.rect_id = self.canvas.create_rectangle(
                self.start_x, self.start_y, self.start_x, self.start_y,
                outline='red', width=2, dash=(5, 5)
            )

    def on_drag(self, event):
        if self.rect_id:
            self.canvas.coords(self.rect_id, self.start_x, self.start_y, event.x, event.y)

    def on_release(self, event):
        if self.rect_id:
            x0, y0 = self.start_x, self.start_y
            x1, y1 = event.x, event.y
            if x0 > x1: x0, x1 = x1, x0
            if y0 > y1: y0, y1 = y1, y0

            if x0 == x1 or y0 == y1:
                messagebox.showwarning("Aviso", "Área de seleção inválida.")
                return

            img_x0 = int((x0 - self.displayed_img_position[0]) * (self.image.width / self.displayed_img_size[0]))
            img_y0 = int((y0 - self.displayed_img_position[1]) * (self.image.height / self.displayed_img_size[1]))
            img_x1 = int((x1 - self.displayed_img_position[0]) * (self.image.width / self.displayed_img_size[0]))
            img_y1 = int((y1 - self.displayed_img_position[1]) * (self.image.height / self.displayed_img_size[1]))

            self.selection_rect = (img_x0, img_y0, img_x1, img_y1)
            self.result_label.config(text="Área selecionada. Clique em 'Analisar Seleção'")

    def analyze_selection(self):
        if not self.image_path or not self.selection_rect:
            messagebox.showwarning("Aviso", "Por favor, selecione uma área da imagem primeiro.")
            return

        try:
            img = Image.open(self.image_path).convert("RGB")
            img_np = np.array(img)
            x0, y0, x1, y1 = self.selection_rect
            if x0 >= x1 or y0 >= y1:
                messagebox.showwarning("Aviso", "Área de seleção inválida.")
                return

            cropped_np = img_np[y0:y1, x0:x1]
            result, highlighted_img = self.process_metal_structures(cropped_np)
            self.result_label.config(text=result)

            # Mostra imagem com áreas destacadas
            highlighted_img = Image.fromarray(highlighted_img)
            highlighted_img.show(title="Áreas Metálicas (Vermelho = Pontos Escuros)")

        except Exception as e:
            messagebox.showerror("Erro", f"Ocorreu um erro ao processar a imagem:\n{str(e)}")

    def process_metal_structures(self, image_np, dark_threshold=140):
        # Converte para HSV para segmentação
        hsv = cv2.cvtColor(image_np, cv2.COLOR_RGB2HSV)

        # Cria máscara para tons metálicos (região de interesse)
        lower_gray = np.array([0, 0, 80])
        upper_gray = np.array([180, 50, 255])
        metal_mask = cv2.inRange(hsv, lower_gray, upper_gray)

        # Limpeza da máscara
        kernel = np.ones((3, 3), np.uint8)
        metal_mask_clean = cv2.morphologyEx(metal_mask, cv2.MORPH_OPEN, kernel)
        metal_mask_clean = cv2.morphologyEx(metal_mask_clean, cv2.MORPH_CLOSE, kernel)

        # Rotula componentes conectados (estruturas individuais)
        num_labels, labels = cv2.connectedComponents(metal_mask_clean)
        sizes = [(i, np.sum(labels == i)) for i in range(1, num_labels)]
        sizes.sort(key=lambda x: x[1], reverse=True)

        if not sizes:
            return "Nenhuma estrutura metálica encontrada.", image_np

        # Prepara imagem de saída e conversão para escala de cinza
        highlighted_img = image_np.copy()
        gray = cv2.cvtColor(image_np, cv2.COLOR_RGB2GRAY)
        results = []

        for i, (label_id, size) in enumerate(sizes[:2]):  # Analisa as 2 maiores estruturas
            # Máscara da estrutura atual (somente pixels desta estrutura)
            structure_mask = (labels == label_id)
            contours, _ = cv2.findContours(structure_mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            # Pixels totais DA ESTRUTURA (não da imagem toda)
            total_pixels = np.sum(structure_mask)

            # Pixels escuros DENTRO DA ESTRUTURA
            dark_pixels_mask = (gray < dark_threshold) & structure_mask
            dark_pixels = np.sum(dark_pixels_mask)

            # Calcula porcentagem
            percent_dark = (dark_pixels / total_pixels) * 100 if total_pixels > 0 else 0

            # Pinta os pontos escuros DE VERMELHO
            highlighted_img[dark_pixels_mask] = [255, 0, 0]  # Canal R=255, G=0, B=0
            cv2.drawContours(highlighted_img, contours, -1, (0, 0, 255 - i * 100), 3)
            results.append(
                f"Estrutura {i + 1}: {percent_dark:.2f}% escuros "
                f"({dark_pixels}/{total_pixels} pixels)"
            )

        return " | ".join(results), highlighted_img

    def reset(self):
        self.selection_rect = None
        self.start_x = None
        self.start_y = None
        if self.rect_id:
            self.canvas.delete(self.rect_id)
            self.rect_id = None
        self.result_label.config(text="Selecione uma área para análise")
        self.display_image()

    def run(self):
        self.root.mainloop()


if __name__ == "__main__":
    root = tk.Tk()
    app = MetalStructureAnalyzer(root)
    app.run()