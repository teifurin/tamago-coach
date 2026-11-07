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
