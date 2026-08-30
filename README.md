# Visual Maker — English

Visual Maker is a browser-based floor plan editor for creating, organizing and visualizing architectural layouts in both 2D and 3D.

The project focuses on making floor plan creation simple and visual, without requiring installation, external software or an internet connection.

Plans can be created in 2D and instantly visualized in an interactive 3D environment.

---

## What can you do?

### 2D floor plan editor

Create and edit floor plans directly in the browser.

Available elements include:

* Walls;
* Doors;
* Windows;
* Rooms;
* Dimensions;
* Text;
* Furniture;
* Outdoor objects;
* Gates;
* Columns and structural elements.

Walls, rooms and objects can be moved, resized and configured using exact measurements.

### Furniture and objects

Visual Maker includes a small library of objects such as:

* Sofa;
* Bed;
* Table;
* Desk;
* Wardrobe;
* TV;
* Refrigerator;
* Stove;
* Counter;
* Sink;
* Toilet;
* Plants;
* Car;
* Pool;
* Barbecue;
* Trees;
* Pergola;
* Gates.

Objects are represented in both the 2D plan and the 3D visualization.

### Colors and materials

Rooms and objects can use different colors and materials.

Available floor materials include:

* Solid color;
* Wood;
* Ceramic;
* Concrete;
* Grass.

The project also includes predefined color palettes that work with both light and dark themes.

### Blueprint mode

The floor plan can be displayed using a blueprint-style visualization with:

* Blue background;
* Technical grid;
* Measurements;
* High-contrast architectural lines.

---

## 3D visualization

The 2D floor plan can be instantly converted into an interactive 3D visualization.

The 3D mode includes:

* Walls with real height and thickness;
* Floors;
* Door and window openings;
* Furniture;
* Gates;
* Structural elements;
* Materials and colors;
* Lighting;
* Perspective camera.

### 3D navigation

Use the mouse to rotate and zoom around the project.

You can also move the camera using:

| Control     | Action        |
| ----------- | ------------- |
| `W` / `↑`   | Move forward  |
| `S` / `↓`   | Move backward |
| `A` / `←`   | Move left     |
| `D` / `→`   | Move right    |
| `Shift`     | Move faster   |
| Mouse drag  | Rotate camera |
| Mouse wheel | Zoom          |

The front walls can also be temporarily hidden to make interior spaces easier to inspect.

---

## Editing in 3D

Furniture and objects can also be adjusted directly from the 3D view.

You can:

* Select objects by clicking them;
* Move objects on the floor;
* Change their elevation;
* Rotate them;
* Snap objects to nearby walls;
* Snap objects into corners;
* Place objects back on the floor;
* Edit exact X and Y coordinates;
* Edit exact rotation and elevation values.

Hold `Alt` while moving an object to temporarily disable snapping.

Structural editing such as creating and modifying walls remains in the 2D editor to keep the floor plan geometry consistent.

---

## Saving projects

Projects can be saved directly in the browser.

The saved project includes the floor plan and its 3D visualization settings, including:

* Elements;
* Dimensions;
* Colors;
* Materials;
* Object positions;
* Object rotations;
* Object elevations;
* 3D camera position;
* 3D camera orientation;
* Current 2D or 3D view;
* Front-wall visibility settings.

When the project is opened again, the 3D visualization is reconstructed from the saved floor plan.

---

## Export

Visual Maker supports multiple export formats.

### 2D

Projects can be exported as:

* PNG;
* SVG;
* Light theme;
* Dark theme;
* Blueprint.

Selected colors and materials are preserved whenever supported by the export format.

### 3D HTML viewer

The complete 3D project can also be exported as a standalone `.html` file.

The exported file:

* Contains the complete 3D visualization;
* Opens directly in a modern browser;
* Works offline;
* Requires no installation;
* Requires no server;
* Allows camera rotation, movement and zoom;
* Can be shared with another person for viewing.

This makes it possible to send an interactive 3D floor plan using only a single file.

---

## How to open

No installation is required.

Download or clone the project and keep all project files in the same folder.

Then double-click:

```text
index.html
```

The application will open directly in your browser.

A modern browser with WebGL support is recommended, such as Chrome, Edge or Firefox.

---

## Technologies

Visual Maker was developed using:

* HTML;
* CSS;
* JavaScript;
* SVG for the 2D editor;
* Canvas / WebGL for the 3D visualization;
* Browser storage for saved projects.

The project does not require a backend or external 3D software to run.

---

## Status

First functional version.

The current version already supports the complete workflow of:

```text
Create floor plan
        |
        v
Edit in 2D
        |
        v
Visualize in 3D
        |
        v
Position furniture
        |
        v
Save project
        |
        v
Export 2D or interactive 3D
```

Future features and improvements can be added in separate versions as the project evolves.

---

## License

This project is available under the MIT License.

See the `LICENSE` file for more information.

---

# Visual Maker — Português

Visual Maker é um editor de plantas baixas executado diretamente no navegador, criado para montar, organizar e visualizar projetos arquitetônicos em 2D e 3D.

O projeto busca tornar a criação de plantas simples e visual, sem exigir instalação, programas externos ou conexão com a internet.

Uma planta criada em 2D pode ser visualizada imediatamente em um ambiente 3D interativo.

---

## O que dá pra fazer?

### Editor de planta baixa 2D

Crie e edite plantas diretamente no navegador.

Entre os elementos disponíveis estão:

* Paredes;
* Portas;
* Janelas;
* Cômodos;
* Cotas;
* Textos;
* Móveis;
* Objetos externos;
* Portões;
* Pilares e outros elementos estruturais.

Paredes, cômodos e objetos podem ser movimentados, redimensionados e configurados utilizando medidas exatas.

### Móveis e objetos

O Visual Maker possui uma biblioteca de objetos que inclui:

* Sofá;
* Cama;
* Mesa;
* Escrivaninha;
* Guarda-roupa;
* TV;
* Geladeira;
* Fogão;
* Balcão;
* Pia;
* Vaso sanitário;
* Plantas;
* Carro;
* Piscina;
* Churrasqueira;
* Árvores;
* Pergolado;
* Portões.

Os objetos são representados tanto na planta 2D quanto na visualização 3D.

### Cores e materiais

Cômodos e objetos podem utilizar diferentes cores e materiais.

Entre os materiais de piso estão:

* Cor lisa;
* Madeira;
* Cerâmica;
* Concreto;
* Grama.

O projeto também possui paletas de cores prontas que funcionam tanto no tema claro quanto no escuro.

### Modo Blueprint

A planta pode ser exibida utilizando uma visualização no estilo blueprint, com:

* Fundo azul;
* Grade técnica;
* Medidas;
* Linhas arquitetônicas de alto contraste.

---

## Visualização 3D

A planta criada no editor 2D pode ser convertida imediatamente para uma visualização 3D interativa.

O modo 3D possui:

* Paredes com altura e espessura;
* Pisos;
* Aberturas para portas e janelas;
* Móveis;
* Portões;
* Elementos estruturais;
* Materiais e cores;
* Iluminação;
* Câmera em perspectiva.

### Navegação 3D

Use o mouse para girar e aproximar a câmera do projeto.

Também é possível movimentar a câmera utilizando:

| Controle       | Ação                |
| -------------- | ------------------- |
| `W` / `↑`      | Avançar             |
| `S` / `↓`      | Recuar              |
| `A` / `←`      | Mover para esquerda |
| `D` / `→`      | Mover para direita  |
| `Shift`        | Movimento rápido    |
| Arrastar mouse | Girar câmera        |
| Scroll         | Zoom                |

As paredes frontais também podem ser temporariamente ocultadas para facilitar a visualização dos ambientes internos.

---

## Edição em 3D

Móveis e objetos também podem ser ajustados diretamente pela visualização 3D.

É possível:

* Selecionar objetos clicando neles;
* Movê-los pelo piso;
* Alterar sua elevação;
* Rotacioná-los;
* Encaixar objetos em paredes próximas;
* Encaixar objetos em cantos;
* Colocar objetos novamente no chão;
* Editar valores exatos de X e Y;
* Editar valores exatos de rotação e elevação.

Segure `Alt` ao mover um objeto para desativar temporariamente os encaixes automáticos.

Alterações estruturais, como criação e modificação de paredes, continuam sendo realizadas pelo editor 2D para manter a geometria da planta consistente.

---

## Salvamento de projetos

Os projetos podem ser salvos diretamente no navegador.

O projeto salvo inclui a planta e as configurações relacionadas à visualização 3D, como:

* Elementos;
* Medidas;
* Cores;
* Materiais;
* Posição dos objetos;
* Rotação dos objetos;
* Elevação dos objetos;
* Posição da câmera 3D;
* Orientação da câmera;
* Visualização atual em 2D ou 3D;
* Configuração de ocultação das paredes frontais.

Ao abrir o projeto novamente, o ambiente 3D é reconstruído automaticamente a partir da planta salva.

---

## Exportação

O Visual Maker possui diferentes opções de exportação.

### 2D

A planta pode ser exportada em:

* PNG;
* SVG;
* Tema claro;
* Tema escuro;
* Blueprint.

As cores e materiais escolhidos são mantidos sempre que o formato de exportação permitir.

### Visualização 3D em HTML

O projeto 3D completo também pode ser exportado como um único arquivo `.html`.

O arquivo exportado:

* Contém a visualização 3D completa;
* Abre diretamente em navegadores modernos;
* Funciona offline;
* Não precisa ser instalado;
* Não precisa de servidor;
* Permite girar, movimentar e aproximar a câmera;
* Pode ser enviado para outra pessoa apenas para visualização.

Isso permite compartilhar uma planta baixa 3D interativa utilizando apenas um arquivo.

---

## Como abrir

Nenhuma instalação é necessária.

Baixe ou clone o projeto e mantenha todos os arquivos na mesma pasta.

Depois, dê duplo clique em:

```text
index.html
```

O Visual Maker será aberto diretamente no navegador.

É recomendado utilizar um navegador moderno com suporte a WebGL, como Chrome, Edge ou Firefox.

---

## Tecnologias

O Visual Maker foi desenvolvido utilizando:

* HTML;
* CSS;
* JavaScript;
* SVG para o editor 2D;
* Canvas / WebGL para a visualização 3D;
* Armazenamento do navegador para salvar os projetos.

O projeto não precisa de backend ou de um programa 3D externo para funcionar.

---

## Status

Primeira versão funcional.

A versão atual já permite realizar o fluxo completo:

```text
Criar planta
      |
      v
Editar em 2D
      |
      v
Visualizar em 3D
      |
      v
Posicionar móveis
      |
      v
Salvar projeto
      |
      v
Exportar em 2D ou 3D interativo
```

Novas funcionalidades e melhorias podem ser adicionadas em versões separadas conforme o projeto evolui.

---

## Licença

Este projeto está licenciado sob a MIT License.

Consulte o arquivo `LICENSE` para mais informações.
