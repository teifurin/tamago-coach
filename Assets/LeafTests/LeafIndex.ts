import { scenariosIndex } from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator";
import { ScenarioMetadata } from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata";
import { TC01StartLayoutScenario } from "./TC01StartLayoutScenario";
import { TC02StepsScenario } from "./TC02StepsScenario";
import { TC03CountdownPauseScenario } from "./TC03CountdownPauseScenario";
import { TC04RollCueScenario } from "./TC04RollCueScenario";
import { TC05GrabDragScenario } from "./TC05GrabDragScenario";
import { TC06IkReachNextScenario } from "./TC06IkReachNextScenario";
import { TC07DemoSpeedApiScenario } from "./TC07DemoSpeedApiScenario";

/**
 * LeafIndex - registers the Tamago Coach LEAF scenarios (one per done criterion of the design
 * brief, plus an IK reachability check). Attached to the root SceneObject "LeafIndex".
 */
@component
export class LeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    { id: "tc-01-start-layout", typename: TC01StartLayoutScenario.getTypeName() },
    { id: "tc-02-steps", typename: TC02StepsScenario.getTypeName() },
    { id: "tc-03-countdown-pause", typename: TC03CountdownPauseScenario.getTypeName() },
    { id: "tc-04-roll-cue", typename: TC04RollCueScenario.getTypeName() },
    { id: "tc-05-grab-drag", typename: TC05GrabDragScenario.getTypeName() },
    { id: "tc-06-ik-reach-next", typename: TC06IkReachNextScenario.getTypeName() },
    { id: "tc-07-demo-speed-api", typename: TC07DemoSpeedApiScenario.getTypeName() },
  ];
}
