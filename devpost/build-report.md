# Tamago Coach 建造报告

写于 2026-11-07 13:10，由建造会话整理。依据：`devpost/design-brief.md`（已批准的设计简报）。建造工具：CLAD（ls-clad 插件）+ Lens Studio 5.24.1 的 MCP + LEAF 2.0.2。

## 一、完成标准 ↔ LEAF 场景 ↔ 通过情况

环境：Lens Studio 5.24.1 预览，Leaf 2.0.2 + SIK 2.0.0，场景串行运行，`__leaf__timeout_secs` 120。测试文件在 `Assets/LeafTests/`（7 个场景 + `TamagoLeafInteractor.ts` + `LeafIndex.ts`），场景里新增根对象 `LeafIndex`。**最终一轮（三项改动后全部重跑）：2026-11-07 13:01:24–13:02:37，tc-01 → tc-07 串行，不改任何代码和场景，7/7 PASSED（Lens Studio 日志时间）。**此前：首轮 12:21–12:32 由测试代理运行（tc-04、tc-05 首轮失败，见表内原话；tc-07 当时按设计失败以复现 bug）；三项改动后 12:54–12:55 先重跑过 tc-02 / tc-04 / tc-06 / tc-07。

| 完成标准 | 场景 id | 最终结果 | 实测与说明 |
|---|---|---|---|
| 1 开场：台面、锅、Prep 卡片在锅远沿旁，台面高度，在正前方；绕着走它不动；字可读 | tc-01-start-layout | 通过（最终一轮 13:01:24） | 头部 (0,0,0)，整套 (0,−45,−70)：前方 70.0 cm、下方 45.0 cm；卡片离锅 19.3 cm 且在上方；2 秒内位移 0.000 cm，不挂在相机下。**没测**：WASD 绕着走、文字可读性（要你在交互预览里看）。 |
| 2 Next 依次 Prep→Heat→Layer 1→Layer 2→Layer 3→Rest & slice，Back 退一步，六步可达 | tc-02-steps | 通过（最终一轮 13:01:37） | 环上数字 1→6、卡片标题、环下标题三处一致；Back 回到 5 / Layer 3。 |
| 3 环自己倒数；捏环停，再捏继续 | tc-03-countdown-pause | 通过（最终一轮 13:01:53） | Heat 开始 59.58 s，3 秒后 56.53 s；捏环后 2 秒冻在 56.29 s 并出现 "II"；再捏后 2 秒 53.79 s。 |
| 4 Demo ×10 下 Layer 1 归零：卡片 "Roll now"、箭头启用；Next 后箭头消失、蛋卷变粗 | tc-04-roll-cue | 通过（最终一轮 13:02:05） | Layer 1 开始后约 2.7 s 归零，卡片 "Roll now"，环 0:00，箭头启用；Next 后蛋卷 0 → 2.6 cm，箭头隐藏，进入 Layer 2。首轮失败原话：`FAILED: tc-04-roll-cue - AssertionError: isDemoSpeed() after setDemoSpeed(true) Expected: "true" - Received: "false"`，是 Lens 的 Demo 开关 bug，已修。**提示音只能靠耳朵。** |
| 5 抓住抓取条拖动，锅、环、卡片、按钮一起走，松手停住 | tc-05-grab-drag | 通过（最终一轮 13:02:17） | StoveSet、Pan、TimerRing、StepCard、NextButton 同步移动 (8.9, 0, 0)，离轴 0.00 cm，松手 1.5 秒不漂。首轮失败原话：`FAILED: tc-05-grab-drag - AssertionError: off-axis motion 68.91 cm, expected <= 3`，原因在 LEAF 的模拟交互器（它报射线距离 0，SIK 把拖动物钳到 1 cm 处），不是 Lens；测试改为像真实手一样报 500 cm 射线后通过。 |
| 附加：真人手臂能否够到 Next | tc-06-ik-reach-next | 通过（最终一轮 13:02:27） | 按钮挪到近侧后 Next 离头 **76.1 cm**（挪前 83.3），仍超出 LEAF 的 67.5 cm 直接够取上限，IK 走远场射线捏；步数 0→1。按你的指示不再调。 |
| 附加：Demo 开关修复的回归测试 | tc-07-demo-speed-api | 通过（最终一轮 13:02:37） | `setDemoSpeed(true)` 后 `isDemoSpeed()` 为 true、开关显示开、1 秒后仍为真；`setDemoSpeed(false)` 后为 false、开关显示关。修复前这条失败。 |

没有测试覆盖的：WASD 绕走、文字可读性、提示音、最后一步切成六片的样子（代码里确认在远侧同位置，没截图）。

## 二、适合录进演示视频的时刻

1. 开场 2 秒：抬头是空房间，低头 33° 看到台面、锅、蓝色抓取条、近侧的 Next/Back、远左角的 Demo ×10 开关，"Prep" 卡片立在锅的远沿上方。旁白："Lens 自带一个灶台，先把它拖到你家的灶上。"
2. 抓取条拖动：捏住蓝色抓取条，整套东西一起跟着走，松手就停。这是"放到真灶台上"的镜头。
3. 开 Demo ×10，捏 Next 两下进到 Layer 1：卡片 0.6 秒后收起只剩环和标题，环上的弧在减少、数字在跳，锅里的蛋从亮黄变淡。
4. 归零那一下（最重要的 3 秒）：叮一声，环闪三下，卡片从环里"开"出来写着 Roll now，蛋上出现一支黄橙色的大箭头从远侧扫向你。这就是简报里"那个空间时刻"。
5. 捏 Next：箭头消失，远侧锅沿出现一卷蛋，新的一层铺在它前面；再走两层，蛋卷一次比一次粗。从你的视角第一卷就能看见。
6. Layer 3 的卡片只剩一句 "Pour, wait, roll. You know this."，和 Layer 1 的长句剪在一起，体现"节奏记住了"。
7. 最后一步归零：蛋卷变成六片，卡片写 "Done! You've learned the layer, pour, roll cycle."
8. 可选：捏一下计时环暂停，环上出现 "II"，再捏恢复。

录之前：双击 TamagoCoach.esproj 打开，预览用 Interactive，WASD/QE 走动，右键拖或 Shift 看四周，点击就是捏。Lens Studio 用完就关。

## 三、CLAD、Lens Studio MCP、LEAF 各做了什么（Devpost 文案用）

- **CLAD（Claude 的 Lens Studio 插件 ls-clad）**：从一份人话写的设计简报 `devpost/design-brief.md` 出发，它的 Specs 建造代理完成了全部实现：规划资产清单和空间布局；用 MeshBuilder 代码生成锅、台面、抓取条、计时环、蛋层/蛋卷/蛋片和箭头这些基础几何体（没有生成式 3D，没有资源库模型）；用本地算法合成提示音 ChimeSoft.wav；用 UI Kit 生成卡片、环上的文字、Next/Back 和 Demo ×10 开关；写了状态机 TamagoCoachMain 以及放置、广告牌、蛋、环等共 13 个 TypeScript 脚本；再通过 VirtualScene 两阶段引导把场景层级和脚本输入接好。之后的三项设计改动（蛋卷改远侧、Demo 开关修复、按钮挪近侧）也是同一个建造代理按设计说明做的定点修改。全程 Lens Studio 没有登录，建造本身 0 次 Snap 请求。
- **Lens Studio MCP**：CLAD 和 Claude 操作 Lens Studio 的唯一通道。场景创建、属性修改、TypeScript 重编译、运行日志采集、预览截图、预览镜头移动、Leaf 测试包安装、LEAF 面板打开和场景执行，全部是 MCP 工具调用；没有 curl，没有手工改工程文件。它也支撑"看一眼再改"的闭环：改代码 → 重编译 → 刷新预览拿日志 → 从用户视角截图判断 → 再改。
- **LEAF（Lens 自动化测试框架）**：在 Lens Studio 预览里用 SIK 的模拟交互器驱动 Lens 本身：捏按钮、捏计时环、拖抓取条、用 IK 手臂去够按钮，再用 expect 断言场景对象的状态（文字内容、对象是否启用、世界坐标、脚本里的只读 API）。五条完成标准各对应一个场景，另加可达性和回归测试各一个；它还真的抓出了一个 bug（Demo 开关把 UIKit Switch 的 explicit 标志当成了状态），修复后用回归场景锁住。结果按日志原话报告，失败不靠改 Lens 来掩盖。

## 四、本轮按你的决定改的三处，以及还留着的设计点

已改（代码在 TamagoCoachEgg.ts、TamagoCoachMain.ts、TamagoCoachControlsUI.ts，场景里 Controls 的位置）：
1. 卷好的蛋卷放在锅内远侧，三档粗细不变，下一层蛋液铺在它前面；六片同位置；箭头仍从远侧扫向你。从 33° 视角第一卷可见（截图 capture1_layer2_start_log_far_side.png）。
2. Demo 开关：回调改读 `sw.isOn`，忽略程序设置产生的回声；`setDemoSpeed` 状态不变时直接返回。
3. Next/Back 挪到台面近侧、锅左边、抓取条后面（Controls 从 z 4 挪到 z 12.5），不重叠、不挡锅（截图 capture0_prep_controls_near.png）。

还留着、由你定的：
- 蛋卷离远壁 0.8 cm（和蛋层远边齐），不是贴墙 0.3 cm；要贴墙是 `logAxisZ` 里一行。
- 箭头尾部会插进蛋卷里（箭头在锅底上方 1.7 cm，蛋卷顶 2.6–3.8 cm）；看起来像"从蛋卷出发指向你"。要完全避开，把 RollArrow 抬到 y 4.5–5.0。
- 卡片"6 秒后收起"被 Demo ×10 一起缩成 0.6 秒。
- Next 离头 76 cm，只能射线捏，直接戳不到（简报只要求捏，符合）。
- UIKit 深色底板在预览里偏淡；蛋层"亮→哑光"只是颜色变化。

## 五、仓库与机器状态

- **没有提交。** 未跟踪新内容：`Assets/Scripts/`、`Assets/LeafTests/`、`Assets/GeneratedSFX/`、`Assets/SimpleVertexBaseColor.lspkg/`、`Packages/Leaf.lspkg`、`Packages/Bitmoji 3D.lsc`、`devpost/`、`.gitattributes`、`.claude/settings.json`、`.virtual-scene.json`（VirtualScene 工具产物，可删或加进 .gitignore）、`leaf_plugin_settings.json`；修改：`Assets/Scene.scene`、`TamagoCoach.esproj`、`.gitignore`、`AGENTS.md`。
- 提交前要决定 `.gitattributes` 里 Lens Studio 加的 LFS 规则（`Assets/**` 会把 .ts 一起走 LFS）。
- 可删的备份：`E:\Claude\TamagoCoach-removed-leaf-4.0.0`、`E:\Claude\TamagoCoach-removed-aipreviewagent-4.0.0`。
- Lens Studio 在这台电脑上空闲时每小时约涨 2 GB 内存，用完就关，不要挂着过夜。

## 六、视觉打磨第一轮（2026-11-07 15:40 补记）

依据 `E:\Claude\實驗\Learn AR with SPECS\视觉打磨清单_v1.md` 的"第一轮（必做）"A–G。只改外观：交互逻辑、六步文案、计时、LEAF 依赖的对象名/层级/位置都没动。做法：CLAD 建造代理以 followup 模式分两轮派出（第一轮 A 材质与光、F 阴影、B 抓取条、E 箭头；第二轮 C 卡片/环/文字、D 按钮/开关），全程通过 Lens Studio MCP，0 次 Snap 服务请求，Lens Studio 未登录；几何体仍全部是 MeshBuilder 代码，没有生成式 3D 和资源库模型。

### 改了什么

- **A 材质与光**：所有网格从无光照顶点色材质换成 Uber PBR 材质（`passInfos.0.Vertex Color = Base Color`，顶点色乘进基色，再按 metallic / roughness 走真实光照）。新材质在 `Assets/Materials/`：CounterPBR（木面 0/0.75）、PanBodyPBR（石墨 0.85/0.45）、PanRimPBR（银色唇边 1.0/0.22）、HandleWoodPBR（木柄 0/0.6）、EggLayerPBR（蛋液，roughness 0.15→0.8、透明度 10%→0 随倒计时变化，运行时克隆）、EggLogPBR（蛋卷 0/0.4）、GrabBarPBR（0.1/0.5）、ArrowGlow（70% 不透明）、ShadowSoft（阴影，顶点透明度）。台面：浅木色、顶面 10×7 网格 ±4% 顶点噪声、0.5 cm 倒角、顶面亮一档。锅：石墨色不发黑、0.6 cm 亮银唇边、内壁比外壁亮、四个内角 1.5 cm 圆角、手柄改圆角长条（前 5 cm 深灰金属、后 7 cm 木色）上翘 8°。蛋液：刚倒入饱和暖黄带高光、归零变浅黄哑光。蛋卷：金黄、4 道略深环带、切片切面略浅。主光改暖色 (1, 0.95, 0.86)、强度 1.15、从用户左上前方打来（旋转 −55°, −35°, 0）。环境反射：模板里环境光引用的两张贴图本来是悬空的，所以里程碑 1 完全没有环境光；Echopark.hdr 在 LS 5.24 导入成 Cubemap 类型，光源槽位不收，最终把 Lens Studio 自带的 Echopark 漫反射/高光二维贴图（带模板引用的原 id）放进 `Assets/Render/EchoparkEnv/`，光源类型改为 EnvMap，锅沿和锅内有了反射。
- **F 阴影与接触**：新脚本 `TamagoCoachContactShadows.ts`（新对象 StoveSet/ContactShadows）在台面上方 0.05 cm 画三个柔边黑色椭圆（锅下 19×23、Next/Back 下 12×14、卡片投影处 22×6，中心 20% 黑、边缘淡出），卡片背后加 26×14 的 10% 深色晕（CardHalo，随卡片缩放收起）。
- **B 抓取条**：改成沿 X 的胶囊（长 30、半径 1.0 cm，即高 2 cm），中段三道竖向握纹环；颜色低饱和灰蓝 (0.45, 0.52, 0.62)，瞄准时 (0.74, 0.82, 0.94)；对象挪到 y 1.0 让底面贴台面（x、z 不变），SIK Interactable + InteractableManipulation 接线不变。
- **E 箭头**：厚 0.8 cm 的三维箭头，尾橙 (1, 0.55, 0.1) → 头亮黄 (1, 0.92, 0.35) 顶点渐变，70% 不透明；启用时从蛋卷前方向用户扫 3 次（每次 1.2 s，带 3 个 0.4 s 内淡出的拖尾残影），然后停在近端持续脉动（缩放 1↔1.04、透明度 0.7↔0.55）；禁用时复位。RollArrow 对象挪到 (3, 4.2, 1.5)、扫动距离 4 cm，尖端停在近侧锅沿上方约 2 cm。
- **C 卡片、环、文字**：卡片底板从 BackPlate 换成 UIKit RoundedRectangle（24×12、圆角 1.5 cm、70% 不透明、0.15 cm 描边）加顶部 0.3 cm 蛋黄色强调线；标题行改为 "Step 1 · Prep"（"Step N ·" 是独立对象 CardStepText，CardTitleText 仍恰好是步骤名，保住 LEAF 断言）；正文左对齐，字号三级 56/50/44，提示行 60% 白；环在卡片展开时隐藏标题、收起时显示；Prep 没有计时时不再显示孤立的大数字（禁用对象、文字内容保留）；环抬高（最终 +1.5 cm 到 y 9.6，见下文的布局调整），卡片放在环顶上方，底边离环顶 1 cm，不重叠；环弧带宽 0.9 cm，剩余弧蛋黄色、走过的弧 30% 白，数字字重 800。
- **D 按钮与开关**：Next 蛋黄色底 (1, 0.78, 0.2) 深色字 "Next ›"，Back 深底 (0.16, 0.17, 0.19) 白字 "‹ Back"，圆角 1.2 cm、0.15 cm 浅色描边；瞄准时整块放大 5% 并变亮；Demo ×10 标签和开关同一基线并排（标签 92% 白），开关开启时滑块蛋黄色。

改动的文件：`Assets/Scripts/Meshes/MeshKit.ts`、`TamagoPanMesh.ts`、`RollArrowMesh.ts`，`Assets/Scripts/TamagoCoachCounterMesh.ts`、`TamagoCoachEgg.ts`、`TamagoCoachGrabBar.ts`、`TamagoCoachCardUI.ts`、`TamagoCoachRingUI.ts`、`TamagoCoachRingMesh.ts`、`TamagoCoachControlsUI.ts`、`TamagoCoachMain.ts`（只加了三处视图调用，测试 API 不变）；新增 `TamagoCoachContactShadows.ts`、`Assets/Materials/`（9 个材质 + TamagoPBR_Base 基础材质及其依赖的 uber_pbr.graphShader、Base.png、Normal.png）、`Assets/Render/EchoparkEnv/`；`Assets/Scene.scene`（光源、新对象、位置、脚本输入）。

### 截图（用户视角：头在台面上方 45 cm、前方 70 cm，低头 32.7° 看台面中心）

- `devpost/screenshots/polish1-prep.png` — Prep。
- `devpost/screenshots/polish1-countdown.png` — Layer 1 倒计时中（Demo 关，0:15，卡片已收起，环下显示 "Layer 1"，蛋液还是刚倒入的亮黄）。
- `devpost/screenshots/polish1-rollnow.png` — Layer 1 归零 "Roll now"，箭头停在近端。
- `devpost/screenshots/polish1-done.png` — Rest & slice 归零，六片切片，"Done!" 卡片。
- 过程图：`wip-run1-A/E.png`、`wip-run2-C.png`、`wip-run2-C-ring.png`、`wip-run2-C-card-lowered.png`（卡片临时放低拍的标题行）、`wip-run2-D.png`。

和里程碑 1 的三张截图（`E:\Claude\實驗\Learn AR with SPECS\截图\capture0/1/2`）比：台面从米色平板变成带木纹和倒角的木面；锅从灰盒变成有反射的石墨锅加银边和木柄；蛋层和蛋卷有了光泽、环带和切面；抓取条从一整条亮蓝变成低饱和胶囊；按钮从黑方块变成蛋黄/深色圆角按钮带图标；卡片有了圆角、描边和强调线，标题并入一行，环和卡片不再叠在一起、环标题不再压锅沿；物体下面有了阴影。

### LEAF 重跑（全部改完、重启 Lens Studio 后，tc-01 → tc-07 串行，不改任何测试）

日志原话（Lens Studio 日志时间 15:36:26–15:37:28）：`[  3.531s]PASSED: tc-01-start-layout`、`[  4.095s]PASSED: tc-02-steps`、`[  9.956s]PASSED: tc-03-countdown-pause`、`[  6.397s]PASSED: tc-04-roll-cue`、`[  5.183s]PASSED: tc-05-grab-drag`、`[  4.330s]PASSED: tc-06-ik-reach-next`、`[  2.853s]PASSED: tc-07-demo-speed-api`。**7/7 通过。**布局调整（环 +1.5、卡片 55°）之后再次全量串行重跑（16:14:28–16:15:32）：`[3.518s]PASSED: tc-01-start-layout`、`[4.339s]PASSED: tc-02-steps`、`[10.043s]PASSED: tc-03-countdown-pause`、`[6.355s]PASSED: tc-04-roll-cue`、`[5.189s]PASSED: tc-05-grab-drag`、`[4.301s]PASSED: tc-06-ik-reach-next`、`[2.846s]PASSED: tc-07-demo-speed-api`，仍是 **7/7**，tc-01 读数 `StepCard=(3.0, -28.4, -85.6) Pan=(3.0, -44.4, -70.0) distance=22.3 cm`。关键读数（第一次重跑）：StepCard 离 Pan 23.5 cm（限 25）；整套 2 s 位移 0.000 cm；Heat 59.66 → 暂停冻在 56.56 → 恢复后 54.16；Layer 1 归零 2749 ms，Next 后蛋卷 0 → 2.6 cm；拖动 8.49 cm、离轴 0.00；Next 离头 76.1 cm 仍走远场射线；setDemoSpeed 双向正确。

### 没做、做不到、要你定的

1. **卡片顶部曾超出 Specs 竖向视野，已按你的决定调整布局**（16:10）。最初按清单把环抬 3 cm、卡片放到环顶上方 1 cm（y 19.8、倾角 30°）后，卡片顶边在视线中心上方约 19.7°，而预览模拟的 Specs 竖向半视野实测约 17.9°（用台面前后边的像素位置标定：焦距 2293 px、中心行 740），所以 33° 低头看台面中心时 "Step N · 标题" 一行被切掉。你选了"环只抬 1.5 cm、卡片倾角加大、底边仍离环顶 1 cm、不重叠、顶边不超过视线中心上方 17.5°"。几何核算下来 45° 倾角做不到（45° 时顶边最低 17.6°，且卡片底边会在视线里压住环顶 0.1°），所以倾角取了 55°：环 (3, 9.6, −9.6)、卡片 (3, 16.56, −15.6)、倾角 55°，卡片底边 y 13.12 = 环顶 12.12 + 1.0，视线里卡片底边在环顶上方约 0.5°（约 0.65 cm），环标题偏移从 4.3 改为 4.0 cm 让它离锅远沿更远。实测（polish1-prep.png 的强调线在第 39 行）：卡片顶边在视线中心上方 **17.0°**（几何预测 17.3°，画面上缘 17.9°），整张卡含标题行可见；环标题 "Layer 1" 底部在锅远沿上方约 0.4°（约 0.5 cm），不压沿；StepCard 离 Pan 约 22.3 cm。
2. 卡片背后的 10% 深色晕在叠加显示上是透明的，设备上看不见，只对预览和录屏有用；台面上的阴影椭圆因为台面本身是虚拟渲染的，设备上可见。
3. 环弧"加粗到 0.6 cm"：原来已是 0.8 cm，按"比现在更粗"处理为 0.9 cm。
4. "卡片用 UI Kit Frame"按"Frame 的外观"处理，用的是 UIKit RoundedRectangle 组件（Frame 自带关闭/跟随按钮和拖动，会让卡片脱离整套，也会影响 LEAF 的位置断言）。字号三级 56/50/44 是 UIKit Subheadline/Body/Caption 的比例按 80 cm 可读性放大后的值（UIKit 原值 ≈ 39/37/34 太小）。
5. 没在预览里验证过的交互态：按钮瞄准放大/变亮、暂停时环的橙色、开关开启时的蛋黄滑块（都编译运行无错，只是没有截到图）；蛋液"刚倒入时的高光和 10% 透明"也只截到了归零后的哑光态。
6. 工具坑（给下次）：`asset-graphql duplicateAsset` 对材质是坏的（会把源资源改名并复制内部 id），建造代理已自救，九个 .mat 是手写文件，文件内部 Material id 与 .meta 注册 id 不同，但重启后按注册 id 正常解析，先不动。
7. 第二轮（蒸汽、筷子小碗、Done 脉冲、Lens 图标）没做，等你决定。

### 仓库状态

没有提交。修改：`Assets/Scene.scene`、上面列出的 11 个脚本及其 .meta；新增未跟踪：`Assets/Materials/`、`Assets/Render/EchoparkEnv/`、`Assets/Scripts/TamagoCoachContactShadows.ts(.meta)`、`devpost/screenshots/`。Lens Studio 在打磨过程中重启了三次（内存到 5–7 GB 就重启，端口和 token 不变）。

## 七、视觉打磨第二轮（2026-11-07 18:00 补记）

四项小打磨，仍只用代码几何体和 UI Kit，不动交互逻辑、文案、计时和 LEAF 依赖的对象名与位置；新加的物体都没有碰撞体和 Interactable，挂在 StoveSet 下随整套移动。前三项由 CLAD 建造代理（followup 模式，一次派出加一次补改）完成，图标由本会话用 Pillow 画。

### 改了什么

1. **蒸汽（Heat 计时中）**：新脚本 `TamagoCoachSteam.ts`，新对象 `StoveSet/Steam` (3, 3.6, 0)。两缕各 8 个拉长的柔边软斑（2.2 × 3.5 cm，白色，顶点透明度峰值 0.14，最多两个叠加约 26%，不超过 30%），从锅面上升 9 cm、1.8 s 一轮、S 形轻摆后淡出，同一个 MeshBuilder 逐帧改顶点。材质复用 ShadowSoft，renderOrder 6。`TamagoCoachMain` 只加了视图调用：进 Heat 且计时在跑时开，归零、切步、暂停时关，恢复时再开；Prep/Layer/Rest 不显示。
2. **筷子和小碗**：新脚本 `TamagoCoachProps.ts`，新对象 `StoveSet/Props`，运行时生成 `Bowl`、`BowlEgg`、`Chopsticks`、`BowlShadow`。碗：24 段旋转体，中心 (18, 0, −10)，口径 8 cm、高 4 cm、底 4.5 cm、壁 0.4 cm，浅陶色 (0.93, 0.90, 0.85)，口沿下一圈 0.4 cm 靛蓝带，内侧带淡一点；碗底蛋液黄圆盘 Ø6.2 × 0.3 cm；碗下 8.2 cm 柔边阴影。筷子：两根 22 cm、Ø0.7→0.5 cm 的木色锥杆（和手柄同色），粗端放在锅与碗之间的台面上 (11.9, 0.25, −4.2) / (11.3, 0.25, −5.0)，斜搭在碗的近左沿（接触点沿杆 4.41 cm），尖端朝远右角升到 (24.1, 15.4, −14.5) / (23.5, 15.4, −15.3)，倾角 43.6°。间距核算（脚本启动时打印）：离卡片板体 4.79 cm、离手柄 3.05 cm、离锅壁 0.83 cm、全部在台面内（maxX 24.35、minZ −15.51）、不压卡片投影阴影、不挡锅/按钮/抓取条/卡片，用户视角里在台面右上角。材质复用 EggLogPBR（碗、蛋液盘）、HandleWoodPBR（筷子）、ShadowSoft（阴影），没有新建材质。
3. **Done 脉冲**：第 6 步归零时六片切片按 0.15 s 逐片出现（`TamagoCoachEgg.showSlices(true)` 改成分 6 次重建网格，`sliceRevealSeconds` 输入）；卡片顶部强调线（`CardUI.pulseAccent`，蛋黄 → (1.0, 0.92, 0.70) → 回）和计时环（`RingMesh.colorPulse`，轨道/弧 → (1.0, 0.80, 0.55) → 回）一起做一次 0.6 s 的正弦暖色脉冲，只在 `done` 置真时触发一次，不循环，结束后精确恢复原色（悬停/暂停色仍优先）；`TamagoCoachMain` 新输入 `donePulseSeconds`（默认 0.6，截图时临时调到 12 秒再恢复）。原有的归零三次缩放脉冲不变。
4. **Lens 图标**：`devpost/icon.png`（512×512，Pillow）：深色圆角底、石墨锅俯视轮廓加银边和手柄、锅里蛋黄色圆角方块、橙色向下箭头。通过 Editor API `project.metaInfo.setIcon()` 设置后 `isIconSet` 当场为 true（文件被拷到 `Cache/icon.png`），但过一会儿就自己回到默认图标，保存后 `TamagoCoach.esproj` 的 `iconHash` 仍为空；试了两次都一样，所以按约定只留文件，提交 Devpost 时在 Project Info 里手动选 `devpost/icon.png` 即可。

改动的文件：新增 `Assets/Scripts/TamagoCoachSteam.ts`、`TamagoCoachProps.ts`（及 .meta）；修改 `TamagoCoachMain.ts`（新输入 steam、donePulseSeconds 和视图调用，测试 API 不变）、`TamagoCoachEgg.ts`、`TamagoCoachCardUI.ts`、`TamagoCoachRingMesh.ts`、`Assets/Scene.scene`（两个新对象、脚本输入值）；新增 `devpost/icon.png`。

### 截图（用户视角，低头 32.7° 看台面中心）

- `devpost/screenshots/polish2-prep.png` — Prep 全景，碗和筷子在台面右上角、手柄后方。
- `devpost/screenshots/polish2-heat-steam.png` — Heat 0:54，两缕淡白蒸汽从锅面升向计时环。
- `devpost/screenshots/polish2-done-pulse.png` — Rest & slice 归零、六片切片齐、环和强调线处于暖色脉冲中（脉冲时长临时延到 12 s 才截到，之后已恢复 0.6 s）。
- 过程图：`wip-run3-props.png`、`wip-run3-steam.png`、`wip-run3-done.png`。

### LEAF 重跑（全部改完、恢复旋钮并保存后，tc-01 → tc-07 串行，不改测试）

`[3.506s]PASSED: tc-01-start-layout`、`[4.127s]PASSED: tc-02-steps`、`[10.021s]PASSED: tc-03-countdown-pause`、`[6.239s]PASSED: tc-04-roll-cue`、`[5.221s]PASSED: tc-05-grab-drag`、`[4.324s]PASSED: tc-06-ik-reach-next`、`[2.841s]PASSED: tc-07-demo-speed-api`（日志时间 17:57:46–17:59:12）。**7/7 通过。** tc-01 `distance=22.3 cm`；tc-05 拖动 8.90 cm、离轴 0.00；tc-06 Next 离头 76.1 cm。

### 说明与遗留

- 筷子倾角 43.6° 比预想的陡：碗高 4 cm 而粗端到碗沿的水平距离只有 4.4 cm（再远就贴到锅壁或手柄），要搭在碗沿上只能这么陡；尖端升到 15.6 cm 高，在视野内、离卡片 4.8 cm。要更平就得把碗放得离锅更远，但台面右边只剩 7 cm。
- 蒸汽、脉冲在预览里都看得见；设备上蒸汽是白色半透明叠加，会比预览更亮一点，`maxAlpha` 输入可调。
- Lens 图标未能通过 Editor API 持久设置（见上）。
- 没有 git 提交。Lens Studio 在这一轮里又重启了两次（内存 6.2 GB、7.0 GB 各一次），结束时 3.4 GB，预览已回到 Prep。
