# VisualMaker

Browser-based floor plan editor for creating, editing and visualizing architectural layouts in **2D and 3D**.

[English](#english) · [Português](#português)

<p align="center">
  <img src="assets/screenshots/2d-3d.gif" alt="VisualMaker 2D to 3D demonstration" width="900">
</p>

<p align="center">
  <strong>Create in 2D. Visualize and edit in 3D.</strong>
</p>

---

## Preview

<p align="center">
  <a href="https://ink-creator.github.io/VisualMaker/" target="_blank">
    <strong>Open Live Demo</strong>
  </a>
</p>

<table> 
  <tr> 
    <td align="center" width="50%"> 
      <strong>2D Editor</strong><br><br> 
      <img src="assets/screenshots/2d-editor.png" alt="VisualMaker 2D Editor"> 
    </td> 
    <td align="center" width="50%"> 
      <strong>Blueprint Mode</strong><br><br> 
      <img src="assets/screenshots/2d-blueprint.png" alt="VisualMaker Blueprint Mode"> 
    </td> 
  </tr> 
  <tr> 
    <td align="center" width="50%"> 
      <strong>3D Visualization</strong><br><br> 
      <img src="assets/screenshots/3d-view.png" alt="VisualMaker 3D Visualization"> 
    </td> 
    <td align="center" width="50%"> 
      <strong>3D Editing</strong><br><br> 
      <img src="assets/screenshots/3d-editor.png" alt="VisualMaker 3D Editing"> 
    </td> 
  </tr> 
</table>

---

# English

## Projects and storeys (file format v4)

One VisualMaker file can contain independent **Projects**. Use the top bar beside undo/redo to add, rename, duplicate, delete and switch projects. Each project owns its floors, elements, palette, grid and saved view. The top bar names the complete file.

**Floors** belong to the selected project. Add or duplicate a floor and select it to edit its contents in 2D or 3D. In floor settings, **Show lower floors (2D)** displays all element types from the floors below, without allowing accidental edits to those references. Framing includes these references even when the active floor is empty. In 3D, show the entire building or only the active floor.

Floor settings control wall height, slab thickness and surface material/color. The next storey starts at the previous storey's base plus its tallest wall (at least the configured floor height), plus the next slab thickness. Object elevation is relative to its own floor. The renderer uses **Z** for the vertical axis; one unit is one metre.

Automatic slabs currently use the bounding rectangle of the floor's walls and rooms; individual rooms retain their own floor finishes. Floor and slab settings are in the menu beside the floor selector.

Save keeps every project and floor in browser storage. **Export → Download VisualMaker file** creates an editable `.visualmaker.json` backup; **Open VisualMaker file** on the home screen imports it. SVG/PNG export the active floor; OBJ exports all floors of the active project. The standalone HTML includes all projects and storeys, their materials, project/floor selectors and camera controls, with no network dependencies.

Older flat files open as Project 1 / Floor 1. The previous independent “floors” migrate into separate projects, each starting at Floor 1, preserving their contents and names.

### Parametric stairs and lighting

3D furniture and structural library objects now match their complete width, depth and height in metres. Height is editable in both property panels; existing explicit dimensions are retained. Defaults include 0.75 m tables/desks, 0.90 m counters, 1.85 m refrigerators and 1.45 m cars. Columns follow the floor's configured height unless overridden. Picking and exported geometry use these same dimensions. Walls have 10 cm skirting, and their default finish no longer changes with the UI theme.

The orbit camera fits the building's projected bounds instead of adding a fixed retreat distance. **Walk inside** offers **Eye height** (1.20–1.95 m, default 1.65 m) and a horizontal **Field of view** (55–95°, default 70°). These settings are saved per project and included in the offline HTML. Horizontal FOV stays consistent across screen aspect ratios; a smaller value reduces the wide-angle appearance. The renderer remains a simplified architectural visualization, not a photorealistic render.

Use **Construction → Stair** to place a native stair on the active floor. Its property panel controls the start and end floors, flight width, overall length, riser count, direction and type (**straight** or **U-shaped with a landing**). Riser height is read-only and follows the actual difference between floor levels, including slabs and taller walls. In a U-shaped stair, total width is twice the flight width; the landing is one flight width deep. Changing the start floor moves the element to that floor.

The 2D symbol includes treads, a break mark, dashed upper steps and an ascent arrow. The destination floor shows a descending reference; edit the stair on its source floor. In 3D, the last tread reaches the destination elevation and the stairwell cuts every intervening slab and room finish, including rotated wells. Select stairs in either viewport to move them or edit their parameters in the property panel. Rotation, mirroring, duplication, undo and copy/paste work in both viewports. Removing a destination leaves a draft with no connection; undo restores the link. Copying an entire project remaps the linked floor IDs. A stair copied onto a floor above its destination also becomes a draft until a new destination is chosen.

SVG/PNG include the stair symbol. JSON preserves the parameters, and OBJ/standalone HTML use the same stepped geometry and openings as the editor. The WebGL shader now combines face normals with ambient and directional diffuse light; exported HTML shares the shader, and OBJ includes vertex normals and unshaded material colors. This lighting does not add cast shadows or a PBR material system.

Run all checks with `node --test tests/*.test.cjs`, including stair geometry, clipping, hierarchy, history, storage and exports.

### Model and checks

`model.js` is the canonical schema and migration layer: `projects[].floors[].elements`. Typed elements retain their existing geometry and carry `projectId` and `floorId`. The editor's `state.elements`, `state.floors` and settings accessors point directly into the active project/floor; no parallel element list is stored. Height calculation is centralized in `VisualMakerModel.floorLayout`. History snapshots and both local/file storage serialize the complete hierarchy. The WebGL, OBJ and HTML paths share the same scene builder.

Run regression tests with Node.js (no package installation required):

```bash
node --test tests/*.test.cjs
node tests/serve.cjs
```

The preview runs at `http://127.0.0.1:4173`. Tests cover migration, independent data, duplication/attachments, round trips, storage failure, floor elevations, selection on upper floors, slab geometry and standalone HTML/OBJ. Generated test files live in ignored `tests/.generated/`.

## About

**VisualMaker** is a browser-based floor plan editor designed to make the creation and visualization of architectural layouts simple and interactive.

Projects are created in a 2D editor and can be instantly transformed into a navigable 3D environment.

The application runs directly in the browser and does not require a backend or external 3D software.

---

## Features

### 2D Floor Plan Editor

Create and edit layouts using:

- Walls
- Doors
- Windows
- Rooms
- Dimensions
- Text
- Furniture
- Outdoor objects
- Gates
- Structural elements

Elements can be positioned and resized using precise measurements.

### Furniture and Object Library

VisualMaker includes objects for different areas of a project, such as:

- Sofa
- Bed
- Table
- Desk
- Wardrobe
- TV
- Refrigerator
- Stove
- Counter
- Sink
- Toilet
- Plants
- Trees
- Car
- Pool
- Barbecue
- Pergola
- Gates

Objects are represented in both the 2D editor and the 3D environment.

### Colors and Materials

Rooms and objects support different colors and materials.

Available floor styles include:

- Solid colors
- Wood
- Ceramic
- Concrete
- Grass

Color presets are also compatible with light and dark themes.

---

## Blueprint Mode

The floor plan can be displayed using a technical blueprint-style visualization.

It includes:

- Blue background
- Architectural grid
- Measurements
- High-contrast lines

This mode can also be exported as an image.

---

## 3D Visualization

The floor plan created in the 2D editor can be transformed directly into an interactive 3D environment.

The 3D representation includes:

- Walls with height and thickness
- Floors
- Door openings
- Window openings
- Furniture
- Structural elements
- Gates
- Materials
- Colors
- Lighting
- Perspective camera

### Camera Controls

WASD is available in the consumer HTML and in **Walk inside**. While editing, use the arrow keys to preserve the tool shortcuts. Drag with the right or middle button to orbit in the editor.

| Control | Action |
| --- | --- |
| `W` / `↑` | Move forward |
| `S` / `↓` | Move backward |
| `A` / `←` | Move left |
| `D` / `→` | Move right |
| `Shift` | Move faster |
| Mouse drag | Rotate camera |
| Mouse wheel | Zoom |

Front walls can also be temporarily hidden to make interior spaces easier to inspect.

---

## 3D Editing

Furniture and other objects can be adjusted directly from the 3D environment.

You can:

- Select objects
- Move objects across the floor
- Change elevation
- Rotate objects
- Edit exact X and Y coordinates
- Edit exact rotation
- Edit exact elevation
- Snap objects to walls
- Snap objects into corners
- Return objects to floor level
- Duplicate objects
- Mirror objects

Holding `Alt` while moving an object temporarily disables automatic snapping.

The 2D and 3D editors share world-space editing operations. The construction toolbar and object library work in both: create walls, doors, windows, rooms, stairs, dimensions, text and furniture on the active floor. Click successive points for walls and dimensions; drag a rectangle for rooms. Wall and dimension endpoints and room corners have resize handles. Moving or resizing a wall keeps its openings attached. Double-click text to edit its content. Shift-click selects multiple elements; group movement, rotation, duplication, deletion, mirroring and clipboard/history commands use the same underlying model.

Tool shortcuts are **Q** select, **W** wall, **E** door, **R** window, **T** room, **Y** stair, **U** dimension and **I** text in both editors. In the 3D editor, **arrow keys** move the camera, **right/middle drag** orbits and the wheel zooms; **Top view** helps precise placement. **Shift+R** rotates the selection and **Escape** cancels a pending shared drag or drawing. The consumer HTML retains WASD/arrows and mouse orbit controls; it includes updated dimensions and text, project/floor selectors, a top view, and switches for walls and annotations. It is a viewer, without the editor's mutation tools; export a new file to share subsequent edits.

**Walk inside** is available in both the editor and the offline HTML. The camera starts on the selected floor at an eye height of 1.65 m. Hold WASD or the arrow keys to walk, Shift to move faster, and drag to look around. On touchscreens, hold the on-screen arrows and drag the scene to look. Walking follows stair treads and landings, passes through door openings and stops at walls and unsupported upper-floor edges. Steps higher than 40 cm cannot be climbed; furniture is not a collision obstacle. All floors remain visible during the walk. **Escape**, **Exit walk**, **Top view** or choosing an editing tool returns to editing/orbit navigation without changing the model.

---

## Saving Projects

Projects can be saved directly in the browser.

Saved data includes:

- Floor plan elements
- Dimensions
- Colors
- Materials
- Object positions
- Object rotations
- Object elevations
- 3D camera position
- Camera orientation
- Current 2D or 3D view
- Front-wall visibility

When a project is opened again, its 3D environment is reconstructed automatically from the saved floor plan.

---

## Export

VisualMaker supports multiple export formats for both 2D and 3D projects.

### 2D Export

Floor plans can be exported as:

- PNG
- SVG
- Light theme
- Dark theme
- Blueprint

### Interactive 3D HTML

The complete 3D environment can be exported as a standalone `.html` file.

The exported viewer:

- Contains the complete 3D scene
- Opens directly in a modern browser
- Works offline
- Requires no installation
- Requires no server
- Supports camera rotation
- Supports camera movement
- Supports zoom

This makes it possible to share an interactive 3D project using only a single HTML file.

### OBJ + MTL Export

The 3D model can also be exported using:

- `.obj` — model geometry
- `.mtl` — material information

These files can be imported into compatible 3D software for further visualization, editing or integration into other workflows.

---

## How to Run

No installation is required.

Clone the repository:

```bash
git clone https://github.com/ink-creator/VisualMaker.git
```

Or download the repository as a ZIP.

Then open:

```text
index.html
```

A modern browser is recommended, such as:

- Google Chrome
- Microsoft Edge
- Mozilla Firefox

---

## Technologies

VisualMaker was built using:

- HTML
- CSS
- JavaScript
- SVG
- WebGL
- Browser storage

No backend is required.

---

## Project Structure

```text
VisualMaker/
├── assets/
│   └── screenshots/
│       ├── 2d-3d.gif
│       ├── 2d-editor.png
│       ├── 2d-blueprint.png
│       ├── 3d-view.png
│       └── 3d-editor.png
├── app.js
├── elements.js
├── geometry.js
├── index.html
├── render.js
├── storage.js
├── styles.css
├── view3d.js
├── LICENSE
└── README.md
```

---

## Current Status

The first functional version already supports the complete workflow:

```text
Create floor plan
       ↓
Edit in 2D
       ↓
Visualize in 3D
       ↓
Edit objects in 3D
       ↓
Save project
       ↓
Export 2D / 3D
```

Future features and improvements can be introduced gradually in new versions.

---

# Português

## Projetos e andares (formato v4)

Um arquivo pode reunir vários **Projetos** independentes. Na barra superior, junto de desfazer/refazer, crie, renomeie, duplique, exclua ou alterne entre eles. Cada projeto guarda seus andares, elementos, paleta, grade e visualização. O nome da barra superior identifica o arquivo completo.

Em **Andares**, adicione ou duplique pavimentos e selecione qual deseja editar. Nas configurações do andar, **Mostrar andares inferiores (2D)** exibe todos os tipos de elemento dos pavimentos abaixo com transparência. Essas referências não podem ser editadas e entram no enquadramento mesmo quando o andar ativo está vazio. No 3D, todos os pavimentos aparecem em suas alturas reais; também é possível mostrar apenas o andar ativo.

Em **Configurações**, ajuste altura do andar, espessura da laje, piso, material e cor. A altura do próximo pavimento considera a maior parede do anterior (no mínimo a altura configurada) e a laje do próximo. A elevação de móveis é relativa ao próprio andar. O eixo vertical do renderizador é **Z**, com medidas em metros.

Pisos automáticos usam o retângulo que envolve paredes e cômodos; cada cômodo mantém seu acabamento próprio. As configurações de piso e laje ficam no menu ao lado do seletor de andar.

**Salvar** preserva todos os projetos e andares no navegador. Para um backup editável, use **Exportar → Baixar arquivo VisualMaker**; reabra pelo botão **Abrir arquivo VisualMaker** na tela inicial. PNG/SVG mostram o andar ativo; OBJ inclui todos os andares do projeto ativo. O HTML independente inclui todos os projetos, seletores de projeto/andar, pisos, materiais e controles de câmera, sem depender de internet.

Arquivos antigos sem hierarquia são migrados para **Projeto 1 → Andar 1**. Os antigos “andares”, que funcionavam como quadros independentes, passam a ser projetos separados, preservando nomes e elementos. O novo histórico de desfazer/refazer também preserva a hierarquia completa.

Para validar a implementação, execute `node --test tests/*.test.cjs`. A arquitetura e os testes estão descritos na seção em inglês acima.

## Sobre

### Escadas paramétricas e iluminação

Use **Construção → Escada** e clique na planta. No painel, configure andar inicial/final, largura de cada lance, comprimento total, número de degraus, direção e tipo: **reta** ou **em U com patamar**. A altura por degrau é calculada automaticamente entre os pisos, considerando lajes e alturas das paredes. Na escada em U, a largura total é o dobro da largura do lance; o patamar tem profundidade igual à largura do lance.

O 2D mostra degraus, linha de corte, trecho superior tracejado e seta de subida. No andar final aparece a referência de descida; edite a escada no andar inicial. No 3D, os degraus alcançam a cota do destino e abrem um vão nas lajes e acabamentos atravessados. Movimentação, edição pelo painel, rotação, espelhamento, cópias e histórico funcionam nos dois editores. Excluir o destino deixa a escada sem conexão até selecionar outro andar; desfazer restaura o vínculo.

As exportações preservam símbolos, parâmetros, geometria e vãos. O shader usa normais das faces, luz ambiente e luz direcional, também no HTML independente. OBJ inclui normais e cores dos materiais sem iluminação aplicada. A iluminação não inclui sombras projetadas nem materiais PBR.

O **VisualMaker** é um editor de plantas baixas executado diretamente no navegador, criado para facilitar a criação e visualização de projetos arquitetônicos em **2D e 3D**.

Os projetos são criados no editor 2D e podem ser transformados imediatamente em um ambiente 3D navegável.

A aplicação funciona diretamente no navegador e não precisa de backend ou programa 3D externo.

---

## Funcionalidades

### Editor de Planta Baixa 2D

Crie e edite plantas utilizando:

- Paredes
- Portas
- Janelas
- Cômodos
- Cotas
- Textos
- Móveis
- Objetos externos
- Portões
- Elementos estruturais

Os elementos podem ser posicionados e redimensionados utilizando medidas precisas.

### Biblioteca de Móveis e Objetos

O VisualMaker possui objetos para diferentes áreas do projeto, incluindo:

- Sofá
- Cama
- Mesa
- Escrivaninha
- Guarda-roupa
- TV
- Geladeira
- Fogão
- Balcão
- Pia
- Vaso sanitário
- Plantas
- Árvores
- Carro
- Piscina
- Churrasqueira
- Pergolado
- Portões

Os objetos possuem representação tanto no editor 2D quanto no ambiente 3D.

### Cores e Materiais

Cômodos e objetos podem utilizar diferentes cores e materiais.

Entre os estilos de piso disponíveis estão:

- Cores sólidas
- Madeira
- Cerâmica
- Concreto
- Grama

As paletas também possuem suporte aos temas claro e escuro.

---

## Modo Blueprint

A planta pode ser exibida utilizando uma visualização técnica no estilo blueprint.

Ela inclui:

- Fundo azul
- Grade arquitetônica
- Medidas
- Linhas de alto contraste

O modo Blueprint também pode ser exportado como imagem.

---

## Visualização 3D

A planta criada no editor 2D pode ser transformada diretamente em um ambiente 3D interativo.

A representação 3D inclui:

- Paredes com altura e espessura
- Pisos
- Aberturas de portas
- Aberturas de janelas
- Móveis
- Elementos estruturais
- Portões
- Materiais
- Cores
- Iluminação
- Câmera em perspectiva

### Controles da Câmera

Móveis e estruturas da biblioteca respeitam largura, profundidade e altura em metros, incluindo os detalhes do modelo. A altura pode ser ajustada no painel de propriedades do 2D ou 3D. Mesas/escrivaninhas usam 0,75 m por padrão; balcões, 0,90 m; geladeiras, 1,85 m; carros, 1,45 m. Pilares acompanham a altura configurada do andar, salvo ajuste próprio. A seleção e os arquivos exportados usam as mesmas dimensões. Paredes têm rodapés de 10 cm e acabamento padrão independente do tema da interface.

O enquadramento 3D considera os limites projetados da construção. Em **Ver como pessoa**, ajuste **Altura dos olhos** (1,20–1,95 m, padrão 1,65 m) e **Campo de visão** horizontal (55–95°, padrão 70°). Esses ajustes ficam salvos por projeto e seguem no HTML exportado. Um campo menor reduz a aparência de grande angular. A visualização continua arquitetônica simplificada, sem renderização fotorrealista.

WASD funciona no HTML do consumidor e em **Ver como pessoa**. Durante a edição, use as setas para preservar os atalhos das ferramentas. Arraste com o botão direito ou central para orbitar no editor.

| Controle | Ação |
| --- | --- |
| `W` / `↑` | Avançar |
| `S` / `↓` | Recuar |
| `A` / `←` | Mover para esquerda |
| `D` / `→` | Mover para direita |
| `Shift` | Movimento rápido |
| Arrastar mouse | Girar câmera |
| Scroll | Zoom |

As paredes frontais também podem ser ocultadas temporariamente para facilitar a visualização dos ambientes internos.

---

## Edição em 3D

Móveis e outros objetos podem ser ajustados diretamente pelo ambiente 3D.

É possível:

- Selecionar objetos
- Movê-los pelo piso
- Alterar a elevação
- Rotacionar
- Editar coordenadas X e Y
- Definir rotação exata
- Definir elevação exata
- Encaixar objetos em paredes
- Encaixar objetos em cantos
- Reposicionar objetos no chão
- Duplicar objetos
- Espelhar objetos

Ao segurar `Alt` durante a movimentação, os encaixes automáticos são temporariamente desativados.

Os editores 2D e 3D compartilham as operações de edição. A barra de construção e a biblioteca funcionam nos dois: crie paredes, portas, janelas, cômodos, escadas, cotas, textos e objetos no andar ativo. Paredes e cotas usam cliques sucessivos; cômodos usam arraste retangular. Pontas das paredes e cotas e cantos dos cômodos têm controles de redimensionamento. Ao mover ou redimensionar paredes, portas e janelas acompanham seus vínculos. Dê duplo clique em um texto para editá-lo. Shift + clique seleciona vários elementos; movimentação, rotação, duplicação, exclusão, espelhamento, copiar/colar e histórico usam o mesmo modelo nos dois modos.

Atalhos: **Q** selecionar, **W** parede, **E** porta, **R** janela, **T** cômodo, **Y** escada, **U** cota e **I** texto. No editor 3D, as **setas** movem a câmera; o **botão direito ou central** orbita; a roda amplia. **Vista superior** ajuda no posicionamento. **Shift + R** gira a seleção; **Escape** cancela desenho ou arraste compartilhado em andamento. O HTML do consumidor continua com WASD/setas e órbita pelo mouse, incluindo geometria, textos e cotas atualizados, seletores de projeto/andar, vista superior e controles de paredes/anotações. Ele é um visualizador, sem ferramentas de alteração; exporte outro arquivo para compartilhar edições posteriores.

**Ver como pessoa** está disponível no editor e no HTML offline. A câmera começa no andar selecionado, com altura de olhos de 1,65 m. Segure WASD ou as setas para andar, Shift para acelerar e arraste para olhar ao redor. Em telas sensíveis ao toque, segure as setas na tela e arraste a cena para olhar. O passeio acompanha degraus e patamares, passa pelos vãos das portas e para nas paredes e nas bordas dos pisos superiores. Degraus acima de 40 cm não são transponíveis; móveis não bloqueiam a passagem. Todos os andares permanecem visíveis durante o passeio. **Escape**, **Sair do passeio**, **Vista superior** ou a escolha de uma ferramenta devolve a navegação/edição sem alterar o modelo.

---

## Salvamento de Projetos

Os projetos podem ser salvos diretamente no navegador.

O projeto salvo inclui:

- Elementos da planta
- Medidas
- Cores
- Materiais
- Posição dos objetos
- Rotação dos objetos
- Elevação dos objetos
- Posição da câmera 3D
- Orientação da câmera
- Visualização atual em 2D ou 3D
- Configuração das paredes frontais

Ao abrir o projeto novamente, o ambiente 3D é reconstruído automaticamente a partir da planta salva.

---

## Exportação

O VisualMaker possui diferentes opções de exportação para projetos 2D e 3D.

### Exportação 2D

A planta pode ser exportada em:

- PNG
- SVG
- Tema claro
- Tema escuro
- Blueprint

### HTML 3D Interativo

O ambiente 3D completo pode ser exportado como um único arquivo `.html`.

O visualizador exportado:

- Contém toda a cena 3D
- Abre diretamente em navegadores modernos
- Funciona offline
- Não precisa de instalação
- Não precisa de servidor
- Permite girar a câmera
- Permite movimentar a câmera
- Permite utilizar zoom

Isso permite compartilhar um projeto 3D interativo utilizando apenas um arquivo HTML.

### Exportação OBJ + MTL

O modelo 3D também pode ser exportado utilizando:

- `.obj` — geometria do modelo
- `.mtl` — informações dos materiais

Esses arquivos podem ser utilizados em softwares 3D compatíveis para visualização, edição ou integração com outros projetos.

---

## Como Executar

Nenhuma instalação é necessária.

Clone o repositório:

```bash
git clone https://github.com/ink-creator/VisualMaker.git
```

Ou baixe o repositório como ZIP.

Depois abra:

```text
index.html
```

É recomendado utilizar um navegador moderno, como:

- Google Chrome
- Microsoft Edge
- Mozilla Firefox

---

## Tecnologias

O VisualMaker foi desenvolvido utilizando:

- HTML
- CSS
- JavaScript
- SVG
- WebGL
- Armazenamento do navegador

O projeto não depende de backend.

---

## Estrutura do Projeto

```text
VisualMaker/
├── assets/
│   └── screenshots/
│       ├── 2d-3d.gif
│       ├── 2d-editor.png
│       ├── 2d-blueprint.png
│       ├── 3d-view.png
│       └── 3d-editor.png
├── app.js
├── elements.js
├── geometry.js
├── index.html
├── render.js
├── storage.js
├── styles.css
├── view3d.js
├── LICENSE
└── README.md
```

---

## Estado Atual

A primeira versão funcional já permite realizar o fluxo completo:

```text
Criar planta
      ↓
Editar em 2D
      ↓
Visualizar em 3D
      ↓
Editar objetos em 3D
      ↓
Salvar projeto
      ↓
Exportar em 2D / 3D
```

Novas funcionalidades e melhorias podem ser adicionadas gradualmente em versões futuras.

---

## License / Licença

This project is available under the **MIT License**.

Este projeto está disponível sob a **Licença MIT**.

See / Consulte [LICENSE](LICENSE).
