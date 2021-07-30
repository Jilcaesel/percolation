/*
   Experiments with percolation
   License CC0.

   Process: 
   Prepare a graph.
   Activate links one at a time.
   Plot the size of the largest connected component against number of links.
 */

function main() {

  let settings = {
    fps : 25,
    dur : 4,
    rounds : 4,
    graph : () => generate_graph_square(40, 40),
    //graph : () => generate_graph_triangle(32, 32),
    image : {
      full  : { w : 800, h : 400 },
      graph : { x :   0, y : 0, w : 400, h : 400 },
      stats : { x : 400, y : 0, w : 400, h : 400 },
    },
  };

  create_gui(settings);

  function pre_start(state) {
    state.frames = Math.floor(state.fps * state.dur);
    state.frame = 0;
  }

  function start(state) {
    pre_start(state);
    animate_start(state);
  }

  function animate_start(state) {
    draw_stats_init(state);
    state.frame = 0;
    animate_restart(state);
    animate_later(state);
  }

  function animate_restart(state) {
    let graph = state.graph();
    state.nodes = graph.nodes;
    state.links = graph.links;
    state.links_active = 0;
    state.largest_cc = null;
    draw_graph(state);
  }

  function animate_later(state) {
    setTimeout(() => animate_step(state), 1000 / state.fps);
  }

  function animate_step(state) {
    if (state.frame == state.frames) {
      animate_finish(state);
      return;
    }
    let round = Math.floor(state.rounds * state.frame / state.frames);
    let f0 = animate_round_to_frame(state, round + 0);
    let f1 = animate_round_to_frame(state, round + 1);
    if (state.frame >= f1) {
      round++;
      f0 = f1;
      f1 = animate_round_to_frame(state, round + 1);
    }
    tile_begin_frame(state);
    if (state.frame == f0)
      animate_restart(state);
    let nl = state.links.length;
    let l0 = Math.floor(nl * (state.frame + 0 - f0) / (f1 - f0));
    let l1 = Math.floor(nl * (state.frame + 1 - f0) / (f1 - f0));
    if (state.links_active != l0)
      throw "something is wrong";
    for (let l = l0; l < l1; l++)
      connect_step(state, l);
    if (state.gifenc != null)
      state.gifenc.addFrame(state.canvas.getContext("2d"));
    state.frame++;
    animate_later(state);
  }

  function animate_finish(state) {
    gif_finish(state);
    tile_finish(state);
  }

  function animate_round_to_frame(state, round) {
    return Math.floor(state.frames * round / state.rounds);
  }

  function create_gui(state) {
    let p = document.createElement("p");
    let r = settings.image.full;
    let canvas = document.createElement("canvas");
    canvas.width = r.w;
    canvas.height = r.h;
    canvas.style.border = "solid 1px black";
    p.appendChild(canvas);
    document.body.appendChild(p);
    state.canvas = canvas;

    let p2 = document.createElement("p");
    let buttons = [ ];
    buttons.push({ t : "Start", cb : start });
    buttons.push({ t : "Start tile", cb : tile_start });
    if (GIFEncoder != null) {
      buttons.push({ t : "Start GIF", cb : gif_start });
    }
    for (let b of buttons) {
      let s = document.createElement("span");
      s.appendChild(document.createTextNode(b.t));
      s.style.cursor = "pointer";
      s.style.border = "solid 1px black";
      s.style.margin = "0 1em";
      s.style.padding = "0.5em";
      s.onclick = () => b.cb(state);
      p2.appendChild(s);
    }
    document.body.appendChild(p2);
  }

  function generate_graph_square(w, h) {
    let nodes = [ ];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        nodes[y * w + x] = {
          x : (x + 0.5) / w,
          y : (y + 0.5) / h,
        };
    let links = [ ];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w - 1; x++)
        links.push([ nodes[y * w + x], nodes[y * w + x + 1] ]);
    for (let x = 0; x < w; x++)
      for (let y = 0; y < h - 1; y++)
        links.push([ nodes[y * w + x], nodes[(y + 1) * w + x] ]);
    return { nodes : nodes, links : links };
  }

  function generate_graph_triangle(w, h) {
    let nodes = [ ];
    for (let y = 0; y < h; y++) {
      let dx = 0.25 + 0.5 * (y & 1);
      for (let x = 0; x < w; x++)
        nodes[y * w + x] = {
          x : (x + dx) / w,
          y : (y + 0.5) / h,
        };
    }
    let links = [ ];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w - 1; x++)
        links.push([ nodes[y * w + x], nodes[y * w + x + 1] ]);
    for (let y = 0; y < h - 1; y++) {
      let dx = -1 + 2 * (y & 1);
      for (let x = 0; x < w; x++) {
        links.push([ nodes[y * w + x], nodes[(y + 1) * w + x] ]);
        if (x + dx >= 0 && x + dx < w)
          links.push([ nodes[y * w + x], nodes[(y + 1) * w + x + dx] ]);
      }
    }
    return { nodes : nodes, links : links };
  }

  function connect_step(state, ln) {
    let n = state.links.length;
    if (ln >= n)
      throw "something is wrong";
    let i = ln + Math.floor(Math.random() * (n - ln));
    let l = state.links[i];
    state.links[i] = state.links[ln];
    state.links[ln] = l;
    draw_link(state, l);
    let c = connect_nodes(l[0], l[1]);
    if (state.largest_cc == null || state.largest_cc.n < c.n)
      state.largest_cc = c;
    draw_stats(state, (ln + 0.5) / n, state.largest_cc.n / state.nodes.length);
    state.links_active++;
  }

  /*
     n.cc points to the node's partial connected component
     cc.par is null if it is the full connected component,
            or points to the larger component
     To join two components, create a parent one,
     and make both .par point to it.
     Update n.cc and cc.par lazily.
   */

  function connect_nodes(n1, n2) {
    let c1 = connect_get_cc(n1);
    let c2 = connect_get_cc(n2);
    if (c1 == null && c2 != null) {
      [ n1, n2 ] = [ n2, n1 ];
      [ c1, c2 ] = [ c2, c1 ];
    }
    let c = c1;
    if (c1 == null) {
      c = n1.cc = n2.cc = { n : 2 };
    } else if (c2 == null) {
      n2.cc = c;
      c.n++;
    } else if (c1 == c2) {
      /* nothing */
    } else {
      c = { n : c1.n + c2.n };
      n1.cc = n2.cc = c1.par = c2.par = c;
    }
    return c;
  }

  function connect_get_cc(n) {
    let c = n.cc;
    if (c == null)
      return null;
    let s = [ ];
    while (c.par != null) {
      s.push(c);
      c = c.par;
    }
    for (let d of s)
      d.cc = c;
    return c;
  }

  function rgba(r, g, b, a) {
    r = Math.floor(256 * r);
    g = Math.floor(256 * g);
    b = Math.floor(256 * b);
    return `rgba(${r},${g},${b},${a})`;
  }

  function draw_get_context(state, part) {
    let pen = state.canvas.getContext("2d");
    let r = state.image[part];
    pen.save();
    let x = r.x;
    let y = r.y;
    if (state.tile != null) {
      x += state.tile.x;
      y += state.tile.y;
    }
    pen.translate(x, y);
    pen.rect(0, 0, r.w, r.h);
    pen.clip();
    return [ pen, r ];
  }

  function draw_release_context(state, pen) {
    pen.restore();
  }

  function draw_clear(state, pen, r) {
    if (state.tile == null) {
      pen.clearRect(0, 0, r.w, r.h);
    } else {
      pen.fillStyle = rgba(1, 1, 1, 1);
      pen.fillRect(0, 0, r.w, r.h);
    }
  }

  function draw_stats_init(state) {
    let [ pen, r ] = draw_get_context(state, "stats");
    draw_clear(state, pen, r);
    pen.beginPath();
    pen.strokeStyle = rgba(0.75, 0.75, 0.75, 1);
    for (let i = 0; i <= 10; i++) {
      let x = Math.floor(i * (r.w - 1) / 10);
      let y = Math.floor(i * (r.h - 1) / 10);
      pen.moveTo(x + 0.5, 0);
      pen.lineTo(x + 0.5, r.h - 1);
      pen.moveTo(1, y + 0.5);
      pen.lineTo(r.w, y + 0.5);
    }
    pen.stroke();
    pen.beginPath();
    pen.strokeStyle = rgba(0, 0, 0, 1);
    pen.moveTo(0.5, 0);
    pen.lineTo(0.5, r.h - 0.5);
    pen.lineTo(r.w, r.h - 0.5);
    pen.stroke();
    draw_release_context(state, pen);
  }

  function draw_get_node_coords(state, n) {
    let r = state.image.graph;
    return [
      Math.floor(n.x * r.w + 0.5),
      Math.floor(n.y * r.h + 0.5),
    ];
  }

  function draw_link_line(state, pen, l) {
    /* TODO torus */
    let [ x1, y1 ] = draw_get_node_coords(state, l[0]);
    let [ x2, y2 ] = draw_get_node_coords(state, l[1]);
    pen.moveTo(x1 + 0.5, y1 + 0.5);
    pen.lineTo(x2 + 0.5, y2 + 0.5);
  }

  function draw_graph(state) {
    let [ pen, r ] = draw_get_context(state, "graph");
    draw_clear(state, pen, r);
    pen.beginPath();
    pen.fillStyle = rgba(0.25, 0.25, 0.25, 1);
    for (let n of state.nodes) {
      let [ x, y ] = draw_get_node_coords(state, n);
      pen.rect(x - 2, y - 2, 5, 5);
    }
    pen.fill();
    pen.beginPath();
    pen.strokeStyle = rgba(0.75, 0.75, 0.75, 1);
    for (let l of state.links)
      draw_link_line(state, pen, l);
    pen.stroke();
    draw_release_context(state, pen);
  }

  function draw_link(state, l) {
    let [ pen, r ] = draw_get_context(state, "graph");
    pen.beginPath();
    pen.strokeStyle = rgba(1, 0, 0, 1);
    draw_link_line(state, pen, l);
    pen.stroke();
    draw_release_context(state, pen);
  }

  function draw_stats(state, x, y) {
    let [ pen, r ] = draw_get_context(state, "stats");
    x = (r.w - 1) * x + 1;
    y = (r.h - 1) * (1 - y);
    pen.beginPath();
    pen.strokeStyle = rgba(0, 0, 1, 0.1);
    pen.moveTo(x, r.h - 1);
    pen.lineTo(x, y);
    pen.stroke();
    draw_release_context(state, pen);
  }

  function gif_start(state) {
    state.gifenc = new GIFEncoder();
    state.gifenc.setRepeat(1);
    state.gifenc.setDelay(1000 / state.fps);
    state.gifenc.start();
    start(state);
  }

  function gif_finish(state) {
    if (state.gifenc == null)
      return;
    state.gifenc.finish();
    state.gifenc.download("percolation.gif");
  }

  function tile_start(state) {
    pre_start(state);
    let r = state.image.full;
    let p = r.w * r.h * state.frames;
    /* Firefox raises a strange exception when the canvas is more that 32768
       but fails to draw properly above 16384. */
    let max_th = Math.floor(16384 / r.h);
    let tw = Math.ceil(state.frames / max_th);
    let th = Math.ceil(state.frames / tw);
    state.tile = { w : tw, h : th, dx : r.w, dy : r.h, x : 0, y : 0 };
    tile_show_commands(state);
    if (p > 10E6)
      if (!confirm(`Render ${p/1E6} megapixels?`))
        return;
    state.canvas.width  = r.w * tw;
    state.canvas.height = r.h * th;
    start(state);
  }

  function tile_begin_frame(state) {
    if (state.tile == null)
      return;
    let pen = state.canvas.getContext("2d");
    let r = state.image.full;
    let fx = state.frame % state.tile.w;
    let fy = Math.floor(state.frame / state.tile.w);
    let ox = state.tile.x;
    let oy = state.tile.y;
    let nx = state.tile.x = fx * state.tile.dx;
    let ny = state.tile.y = fy * state.tile.dy;
    if (state.frame > 0) {
      pen.drawImage(state.canvas, ox, oy, r.w, r.h, nx, ny, r.w, r.h);
      if (ny > oy)
      window.scrollBy(0, ny - oy);
    }
  }

  function tile_finish(state) {
    if (state.tile == null)
      return;
  }

  function tile_show_commands(state) {
    let t = state.tile;
    let txt = `ffmpeg -framerate ${state.fps}/${t.w*t.h} -i canvas.png ` +
      `-vf format=rgb24,untile=${t.w}x${t.h},trim=end_frame=${state.frames} ` +
      `-c png canvas.mkv`;
    txt += "\nffmpeg -i canvas.mkv -c libvpx-vp9 -lossless 1 " +
      "-deadline best canvas.webm";
    txt += "\nffmpeg -i canvas.mkv -vf " +
      "'split[a][b];[a]palettegen[p];[b][p]paletteuse=dither=none' canvas.gif";
    let pre = document.createElement("pre");
    pre.appendChild(document.createTextNode(txt));
    document.body.appendChild(pre);
  }

}
