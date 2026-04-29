#pragma once

/**
 * AlloLib Studio Online - ParamGraph (header-only)
 *
 * Modulation routing as a visible patch graph on top of al::Parameter.
 * Each frame, every destination parameter receives the sum of
 * (sampler() * scale + offset) over all incoming connections, and the
 * sum is written via Parameter::set().
 *
 * Sources can be either:
 *   - a parameter node added via addParameter() (sampler returns
 *     Parameter::get()), or
 *   - an arbitrary std::function<float()> sampler added via addSource()
 *     (LFO, mouse pos, audio feature, etc).
 *
 * Cycle detection at connect(): a DFS over outgoing edges from `dst`
 * checks for a path back to `src`. If found, the connection is refused
 * and a printf warning is emitted.
 *
 * JSON persistence: every node's id, name, kind, x, y is written along
 * with every edge's (src, dst, scale, offset). Loading restores the
 * graph topology and node positions; sampler bodies cannot be
 * serialized -- on load, ANY source node ends up unbound (returns 0)
 * until the user calls setSampler(id, fn) to re-attach it. Likewise,
 * parameter nodes need to be re-attached to a live al::Parameter via
 * rebindParameter(id, &p); see notes below.
 *
 * In-canvas editor (no ImGui): drawImGui(title) renders nodes as Mesh
 * boxes with labels (printf if no font supplied), edges as LINES, and
 * supports mouse drag for moving nodes and click-drag from one node to
 * another to create a connection. Layout is persisted in the graph
 * itself so JSON round-trips preserve the editor state.
 *
 * Threading: tick(), connect(), and drawing all run on the main thread.
 * No std::thread / pthread.
 */

#include "al/graphics/al_Graphics.hpp"
#include "al/graphics/al_Mesh.hpp"
#include "al/io/al_Window.hpp"  // al::Mouse
#include "al/types/al_Color.hpp"
#include "al/ui/al_Parameter.hpp"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <functional>
#include <memory>
#include <optional>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>

#include <nlohmann/json.hpp>

#if __has_include("al_WebFont.hpp")
#include "al_WebFont.hpp"
#define AL_STUDIO_PARAM_GRAPH_HAS_WEBFONT 1
#else
#define AL_STUDIO_PARAM_GRAPH_HAS_WEBFONT 0
#endif

namespace al {
namespace studio {

class ParamGraph {
public:
  using NodeId = int;

  enum class NodeKind : int { Parameter = 0, Source = 1 };

  struct Node {
    NodeId id;
    NodeKind kind;
    std::string name;
    al::Parameter* param;            // non-null when kind==Parameter
    std::function<float()> sampler;  // non-null when kind==Source (or
                                     // re-bound parameter sampler)
    float x;                         // editor x (graph-local pixels)
    float y;                         // editor y
    bool isDestination;              // true if any inbound edge exists
  };

  struct Edge {
    NodeId src;
    NodeId dst;
    float scale;
    float offset;
  };

  ParamGraph() = default;
  ParamGraph(const ParamGraph&) = delete;
  ParamGraph& operator=(const ParamGraph&) = delete;

  // ---------------- node creation --------------------------------------

  NodeId addParameter(al::Parameter& p) {
    Node n;
    n.id = nextId();
    n.kind = NodeKind::Parameter;
    n.name = p.getName();
    n.param = &p;
    al::Parameter* pp = &p;
    n.sampler = [pp]() { return pp->get(); };
    layoutNew(n);
    mNodes.push_back(std::move(n));
    mIndex[mNodes.back().id] = mNodes.size() - 1;
    return mNodes.back().id;
  }

  NodeId addSource(const std::string& name, std::function<float()> sampler) {
    Node n;
    n.id = nextId();
    n.kind = NodeKind::Source;
    n.name = name;
    n.param = nullptr;
    n.sampler = std::move(sampler);
    layoutNew(n);
    mNodes.push_back(std::move(n));
    mIndex[mNodes.back().id] = mNodes.size() - 1;
    return mNodes.back().id;
  }

  // Re-attach a sampler after loadJSON (or to swap one at runtime).
  void setSampler(NodeId id, std::function<float()> sampler) {
    if (Node* n = nodeOpt(id)) {
      n->sampler = std::move(sampler);
    }
  }

  // Re-bind a parameter pointer for a parameter-kind node loaded from JSON.
  // Required because al::Parameter cannot be serialized.
  void rebindParameter(NodeId id, al::Parameter* p) {
    if (Node* n = nodeOpt(id)) {
      n->param = p;
      if (p) {
        n->kind = NodeKind::Parameter;
        n->name = p->getName();
        n->sampler = [p]() { return p->get(); };
      }
    }
  }

  // ---------------- connections ----------------------------------------

  // Returns true on success. Refuses self-loops and any connection that
  // would create a cycle. Existing edges are not duplicated; a new
  // connect() with the same (src,dst) updates scale/offset.
  bool connect(NodeId src, NodeId dst, float scale = 1.f, float offset = 0.f) {
    if (src == dst) {
      std::printf("[ParamGraph] refused self-loop on node %d\n", src);
      return false;
    }
    if (!nodeOpt(src) || !nodeOpt(dst)) {
      std::printf("[ParamGraph] connect: bad node id (src=%d dst=%d)\n",
                  src, dst);
      return false;
    }
    // Destination must be a parameter (we need somewhere to write into).
    Node* d = nodeOpt(dst);
    if (d->kind != NodeKind::Parameter || d->param == nullptr) {
      std::printf("[ParamGraph] refused: dst %d is not a writable parameter\n",
                  dst);
      return false;
    }
    // Existing edge: update in place.
    for (auto& e : mEdges) {
      if (e.src == src && e.dst == dst) {
        e.scale = scale;
        e.offset = offset;
        return true;
      }
    }
    // Cycle check: if there is already a path dst -> ... -> src, then
    // adding src -> dst would close a cycle.
    if (hasPath(dst, src)) {
      std::printf("[ParamGraph] refused: edge %d->%d would create a cycle\n",
                  src, dst);
      return false;
    }
    mEdges.push_back(Edge{src, dst, scale, offset});
    d->isDestination = true;
    return true;
  }

  void disconnect(NodeId src, NodeId dst) {
    mEdges.erase(std::remove_if(mEdges.begin(), mEdges.end(),
                                [src, dst](const Edge& e) {
                                  return e.src == src && e.dst == dst;
                                }),
                 mEdges.end());
    // Recompute isDestination flags.
    for (auto& n : mNodes) n.isDestination = false;
    for (const auto& e : mEdges) {
      if (Node* d = nodeOpt(e.dst)) d->isDestination = true;
    }
  }

  // ---------------- evaluation ------------------------------------------

  void tick() {
    if (mEdges.empty()) return;
    // Sum incoming contributions per destination parameter.
    std::unordered_map<NodeId, float> sums;
    sums.reserve(mEdges.size());
    for (const auto& e : mEdges) {
      Node* s = nodeOpt(e.src);
      Node* d = nodeOpt(e.dst);
      if (!s || !d || d->param == nullptr) continue;
      float v = 0.f;
      if (s->sampler) v = s->sampler();
      const float contrib = v * e.scale + e.offset;
      sums[e.dst] += contrib;
    }
    for (auto& kv : sums) {
      Node* d = nodeOpt(kv.first);
      if (d && d->param) d->param->set(kv.second);
    }
  }

  // ---------------- introspection --------------------------------------

  const std::vector<Node>& nodes() const { return mNodes; }
  const std::vector<Edge>& edges() const { return mEdges; }
  size_t numNodes() const { return mNodes.size(); }
  size_t numEdges() const { return mEdges.size(); }

  Node* nodeOpt(NodeId id) {
    auto it = mIndex.find(id);
    if (it == mIndex.end()) return nullptr;
    return &mNodes[it->second];
  }
  const Node* nodeOpt(NodeId id) const {
    auto it = mIndex.find(id);
    if (it == mIndex.end()) return nullptr;
    return &mNodes[it->second];
  }

#if AL_STUDIO_PARAM_GRAPH_HAS_WEBFONT
  void setFont(WebFont* f) { mFont = f; }
#endif

  // Mark a node so the user can call setSampler() later. Useful after
  // loadJSON which can't restore lambdas.
  bool nodeNeedsRebind(NodeId id) const {
    const Node* n = nodeOpt(id);
    if (!n) return false;
    if (n->kind == NodeKind::Source) return !n->sampler;
    return n->param == nullptr;
  }

  // ---------------- editor (in-canvas, no ImGui) -----------------------

  // Editor rect setup. By default the editor uses 800x600 starting at
  // (0,0) -- examples usually push their own ortho projection covering
  // this rect.
  void setEditorRect(float x, float y, float w, float h) {
    mEditorX = x;
    mEditorY = y;
    mEditorW = (w > 1.f) ? w : 1.f;
    mEditorH = (h > 1.f) ? h : 1.f;
  }

  // Mouse callbacks. Examples wire these from App::onMouse{Down,Drag,Up}.
  void onMouseDown(const al::Mouse& m) {
    const float mx = static_cast<float>(m.x()) - mEditorX;
    const float my = static_cast<float>(m.y()) - mEditorY;
    NodeId hit = pickNode(mx, my);
    if (hit < 0) {
      mDragNode = -1;
      mPendingConnSrc = -1;
      return;
    }
    if (m.right()) {
      // Right-click on a node = start a connection.
      mPendingConnSrc = hit;
      mRubberX = mx;
      mRubberY = my;
      mDragNode = -1;
    } else {
      // Left-click = drag node.
      mDragNode = hit;
      Node* n = nodeOpt(hit);
      mDragOffX = mx - n->x;
      mDragOffY = my - n->y;
      mPendingConnSrc = -1;
    }
  }

  void onMouseDrag(const al::Mouse& m) {
    const float mx = static_cast<float>(m.x()) - mEditorX;
    const float my = static_cast<float>(m.y()) - mEditorY;
    if (mDragNode >= 0) {
      if (Node* n = nodeOpt(mDragNode)) {
        n->x = std::clamp(mx - mDragOffX, 0.f, mEditorW - kNodeW);
        n->y = std::clamp(my - mDragOffY, 0.f, mEditorH - kNodeH);
      }
    } else if (mPendingConnSrc >= 0) {
      mRubberX = mx;
      mRubberY = my;
    }
  }

  void onMouseUp(const al::Mouse& m) {
    const float mx = static_cast<float>(m.x()) - mEditorX;
    const float my = static_cast<float>(m.y()) - mEditorY;
    if (mPendingConnSrc >= 0) {
      NodeId hit = pickNode(mx, my);
      if (hit >= 0 && hit != mPendingConnSrc) {
        connect(mPendingConnSrc, hit, 1.f, 0.f);
      }
      mPendingConnSrc = -1;
    }
    mDragNode = -1;
  }

  // The plan-mandated entrypoint. Renders the editor at the configured
  // rect. Title is reserved for a future Vue overlay; we draw it as a
  // small label via WebFont when available, else printf it once.
  void drawImGui(const char* windowTitle) {
    if (!sLastGraphics) {
      // No render context yet -- caller should call drawAt() first.
      return;
    }
    drawAt(*sLastGraphics, mEditorX, mEditorY, mEditorW, mEditorH,
           windowTitle);
  }

  // Explicit-rect draw (preferred when not relying on the static cache).
  void drawAt(al::Graphics& g, float x, float y, float w, float h,
              const char* windowTitle = nullptr) {
    sLastGraphics = &g;
    setEditorRect(x, y, w, h);

    g.pushMatrix();
    g.translate(x, y);

    // Background.
    {
      al::Mesh bg(al::Mesh::TRIANGLES);
      const al::Color c{0.07f, 0.08f, 0.10f, 0.85f};
      addRect(bg, 0.f, 0.f, w, h, c);
      g.meshColor();
      g.draw(bg);
    }

    // Edges first (under nodes).
    {
      al::Mesh edges(al::Mesh::LINES);
      for (const auto& e : mEdges) {
        const Node* s = nodeOpt(e.src);
        const Node* d = nodeOpt(e.dst);
        if (!s || !d) continue;
        const float sx = s->x + kNodeW;
        const float sy = s->y + kNodeH * 0.5f;
        const float dx = d->x;
        const float dy = d->y + kNodeH * 0.5f;
        // Color edge by absolute scale for quick visual sanity.
        const float a = std::clamp(0.4f + 0.4f * std::abs(e.scale), 0.f, 1.f);
        edges.color(0.5f, 0.9f, 1.f, a);
        edges.vertex(sx, sy);
        edges.color(0.5f, 0.9f, 1.f, a);
        edges.vertex(dx, dy);
      }
      if (edges.vertices().size() >= 2) {
        g.draw(edges);
      }
    }

    // Rubber-band edge during a pending connection.
    if (mPendingConnSrc >= 0) {
      if (const Node* s = nodeOpt(mPendingConnSrc)) {
        al::Mesh rubber(al::Mesh::LINES);
        rubber.color(1.f, 1.f, 0.4f, 0.9f);
        rubber.vertex(s->x + kNodeW, s->y + kNodeH * 0.5f);
        rubber.color(1.f, 1.f, 0.4f, 0.9f);
        rubber.vertex(mRubberX, mRubberY);
        g.draw(rubber);
      }
    }

    // Nodes.
    {
      al::Mesh boxes(al::Mesh::TRIANGLES);
      al::Mesh outlines(al::Mesh::LINE_STRIP);
      for (const auto& n : mNodes) {
        const al::Color fill = (n.kind == NodeKind::Parameter)
                                   ? al::Color(0.18f, 0.32f, 0.55f, 1.f)
                                   : al::Color(0.45f, 0.20f, 0.45f, 1.f);
        addRect(boxes, n.x, n.y, kNodeW, kNodeH, fill);
        // Outlines per box: emit each as a fresh LINE_STRIP via separate
        // small Mesh because LINE_STRIP can't be discontiguous.
        al::Mesh ol(al::Mesh::LINE_STRIP);
        const al::Color outline = n.isDestination
                                      ? al::Color(0.9f, 0.9f, 0.4f, 1.f)
                                      : al::Color(0.85f, 0.85f, 0.85f, 1.f);
        ol.color(outline);
        ol.vertex(n.x, n.y);
        ol.color(outline);
        ol.vertex(n.x + kNodeW, n.y);
        ol.color(outline);
        ol.vertex(n.x + kNodeW, n.y + kNodeH);
        ol.color(outline);
        ol.vertex(n.x, n.y + kNodeH);
        ol.color(outline);
        ol.vertex(n.x, n.y);
        g.draw(ol);
      }
      g.meshColor();
      g.draw(boxes);
    }

#if AL_STUDIO_PARAM_GRAPH_HAS_WEBFONT
    if (mFont) {
      for (const auto& n : mNodes) {
        mFont->render(g, n.name, n.x + 6.f, n.y + 4.f);
      }
      if (windowTitle) mFont->render(g, windowTitle, 6.f, h - 18.f);
    } else {
      labelOnceViaPrintf(windowTitle);
    }
#else
    labelOnceViaPrintf(windowTitle);
#endif

    g.popMatrix();
  }

  // ---------------- JSON I/O -------------------------------------------
  // Schema:
  // {
  //   "version": 1,
  //   "nextId": 9,
  //   "nodes": [
  //     {"id":0,"kind":"parameter","name":"gain","x":40,"y":40},
  //     {"id":1,"kind":"source","name":"lfo","x":40,"y":120}
  //   ],
  //   "edges": [
  //     {"src":1,"dst":0,"scale":0.5,"offset":0.5}
  //   ]
  // }
  bool saveJSON(const std::string& path) const {
    nlohmann::json j;
    j["version"] = 1;
    j["nextId"] = mNextId;
    j["nodes"] = nlohmann::json::array();
    for (const auto& n : mNodes) {
      nlohmann::json jn;
      jn["id"] = n.id;
      jn["kind"] = (n.kind == NodeKind::Parameter) ? "parameter" : "source";
      jn["name"] = n.name;
      jn["x"] = n.x;
      jn["y"] = n.y;
      j["nodes"].push_back(jn);
    }
    j["edges"] = nlohmann::json::array();
    for (const auto& e : mEdges) {
      nlohmann::json je;
      je["src"] = e.src;
      je["dst"] = e.dst;
      je["scale"] = e.scale;
      je["offset"] = e.offset;
      j["edges"].push_back(je);
    }
    std::ofstream out(path);
    if (!out) return false;
    out << j.dump(2);
    out.flush();
    if (!out) return false;
#ifdef __EMSCRIPTEN__
    EM_ASM({
      try {
        if (typeof FS !== 'undefined' && FS.syncfs)
          FS.syncfs(false, function(err) {});
      } catch (e) {}
    });
#endif
    return true;
  }

  // Loads topology and node positions. Parameter nodes are restored as
  // *unbound* (param=nullptr) -- caller must then walk nodes() and call
  // rebindParameter(id, &p) to wire each one up. Source nodes are
  // restored without a sampler -- use setSampler(id, fn) to attach.
  bool loadJSON(const std::string& path) {
    std::ifstream in(path);
    if (!in) return false;
    nlohmann::json j;
    try {
      in >> j;
    } catch (...) {
      return false;
    }
    mNodes.clear();
    mEdges.clear();
    mIndex.clear();
    if (j.contains("nextId")) mNextId = j["nextId"].get<int>();
    if (j.contains("nodes")) {
      for (const auto& jn : j["nodes"]) {
        Node n;
        n.id = jn.value("id", -1);
        const std::string kind = jn.value("kind", "source");
        n.kind = (kind == "parameter") ? NodeKind::Parameter : NodeKind::Source;
        n.name = jn.value("name", std::string{});
        n.x = jn.value("x", 0.f);
        n.y = jn.value("y", 0.f);
        n.param = nullptr;
        n.sampler = nullptr;
        n.isDestination = false;
        if (n.id < 0) continue;
        mIndex[n.id] = mNodes.size();
        mNodes.push_back(std::move(n));
        if (mNodes.back().id >= mNextId) mNextId = mNodes.back().id + 1;
      }
    }
    if (j.contains("edges")) {
      for (const auto& je : j["edges"]) {
        Edge e;
        e.src = je.value("src", -1);
        e.dst = je.value("dst", -1);
        e.scale = je.value("scale", 1.f);
        e.offset = je.value("offset", 0.f);
        if (e.src < 0 || e.dst < 0) continue;
        if (!nodeOpt(e.src) || !nodeOpt(e.dst)) continue;
        mEdges.push_back(e);
        if (Node* d = nodeOpt(e.dst)) d->isDestination = true;
      }
    }
    return true;
  }

private:
  // ---------------- helpers ---------------------------------------------

  NodeId nextId() { return mNextId++; }

  // Initial layout: simple grid based on insertion order. The user can
  // drag nodes after the fact and the positions persist in JSON.
  void layoutNew(Node& n) {
    const int k = static_cast<int>(mNodes.size());
    const int col = k / 6;
    const int row = k % 6;
    n.x = 40.f + col * (kNodeW + 60.f);
    n.y = 40.f + row * (kNodeH + 20.f);
    n.isDestination = false;
  }

  NodeId pickNode(float mx, float my) const {
    for (auto it = mNodes.rbegin(); it != mNodes.rend(); ++it) {
      if (mx >= it->x && mx <= it->x + kNodeW && my >= it->y &&
          my <= it->y + kNodeH) {
        return it->id;
      }
    }
    return -1;
  }

  // DFS from `start` over outgoing edges; returns true if `target` is
  // reachable. Used for cycle detection: hasPath(dst, src) means adding
  // src -> dst would close a cycle.
  bool hasPath(NodeId start, NodeId target) const {
    if (start == target) return true;
    std::unordered_set<NodeId> visited;
    std::vector<NodeId> stack;
    stack.push_back(start);
    while (!stack.empty()) {
      const NodeId cur = stack.back();
      stack.pop_back();
      if (cur == target) return true;
      if (!visited.insert(cur).second) continue;
      for (const auto& e : mEdges) {
        if (e.src == cur) {
          if (e.dst == target) return true;
          stack.push_back(e.dst);
        }
      }
    }
    return false;
  }

  static void addRect(al::Mesh& m, float x, float y, float w, float h,
                      const al::Color& c) {
    m.color(c); m.vertex(x, y);
    m.color(c); m.vertex(x + w, y);
    m.color(c); m.vertex(x + w, y + h);
    m.color(c); m.vertex(x, y);
    m.color(c); m.vertex(x + w, y + h);
    m.color(c); m.vertex(x, y + h);
  }

  void labelOnceViaPrintf(const char* windowTitle) {
    if (mPrintedLabels) return;
    mPrintedLabels = true;
    if (windowTitle) std::printf("[ParamGraph] %s\n", windowTitle);
    for (const auto& n : mNodes) {
      std::printf("  node %d: %s (%s)\n", n.id, n.name.c_str(),
                  n.kind == NodeKind::Parameter ? "param" : "source");
    }
  }

  static constexpr float kNodeW = 110.f;
  static constexpr float kNodeH = 36.f;

  std::vector<Node> mNodes;
  std::vector<Edge> mEdges;
  std::unordered_map<NodeId, size_t> mIndex;
  int mNextId{0};

  // Editor state.
  float mEditorX{0.f}, mEditorY{0.f}, mEditorW{800.f}, mEditorH{600.f};
  NodeId mDragNode{-1};
  float mDragOffX{0.f}, mDragOffY{0.f};
  NodeId mPendingConnSrc{-1};
  float mRubberX{0.f}, mRubberY{0.f};
  bool mPrintedLabels{false};
#if AL_STUDIO_PARAM_GRAPH_HAS_WEBFONT
  WebFont* mFont{nullptr};
#endif

  inline static al::Graphics* sLastGraphics = nullptr;

public:
  static void setGraphicsContext(al::Graphics& g) { sLastGraphics = &g; }
};

}  // namespace studio
}  // namespace al
