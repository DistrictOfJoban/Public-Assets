importPackage(java.awt);
importPackage(java.awt.geom);
importPackage(java.nio);
include(Resources.idRelative("mtr:lib/harrys_lib.js"));
include("display.js");

var rawModels = ModelManager.loadPartedRawModel(Resources.manager(), Resources.idRelative("mtr:yutong/yutong.obj"), null);
var models = uploadPartedModels(rawModels, true, true);

function create(ctx, state, train) {

	initRoll(train, state);
	initWheelAngle(state);
	initTurnState(train, state);
	initSteeringAngle(train, state);
	initSpeedStates(state);
	displCreate(ctx, state, train);
	// test
	// initRocking(train, state)
}

function dispose(ctx, state, train) {
	displDispose(ctx, state, train)
}

function render(ctx, state, train) {
	updateLogic(state, train);
	renderLogic(ctx, state, train);
}

function updateLogic(state, train) {
	updateRoll(train, state, 1);
	updateWheelAngle(train, state);
	updateSteeringAngle(train, state);
	updateTurnState(train, state);
	updateSpeedStates(train, state);
	//updateRocking(train, state, 30, 30, 10, 10);
}

function renderLogic(ctx, state, train) {
	var matrices = new Matrices();
	matrices.translate(0.0, -1.0, 0.0);

	renderBody(ctx, state, train, matrices);
	renderBackWheels(ctx, state, train, matrices);
	renderFrontWheels(ctx, state, train, matrices);
}

function renderTurnLights(ctx, state, train, matrices) {
	let shouldRenderTurnLights = Timing.elapsed() % 1.0 > 0.5;
	if (state.isTurningRight && shouldRenderTurnLights) ctx.drawCarModel(models["turn_right"], 0, matrices);
	if (state.isTurningLeft && shouldRenderTurnLights) ctx.drawCarModel(models["turn_left"], 0, matrices);
}

function renderTranslucent(ctx, state, train, matrices) {
	ctx.drawCarModel(models["windows"], 0, matrices);
}

function renderLights(ctx, state, train, matrices) {
	let shouldRenderLights = MinecraftClient.worldDayTime() % 24000 > 13000;
	if (shouldRenderLights) {
		ctx.drawCarModel(models["fary"], 0, matrices);
	}
}

function renderBreakLights(ctx, state, train, matrices) {
	if (state.isBreaking) ctx.drawCarModel(models["break"], 0, matrices);
}

function renderBody(ctx, state, train, matrices) {
	matrices.pushPose();
	let roll = state.rolls[0]
	// rocking test
	// let rocking = pseudoSin(state.rockingZCoef) / 40;
	
	
	//
	let doorValue = train.doorLeftOpen[0] ? clamp(train.doorValue() * 2, 0, 1) : 0.0;

	roll = clamp(roll, -0.3, 0.3)
	matrices.rotateZ(roll);
	// display
	matrices.pushPose();
	matrices.translate(0.25, 0, 0);
	displRender(ctx, state, train, matrices);
	matrices.popPose();
	// body
	ctx.drawCarModel(models["ext"], 0, matrices);
	ctx.drawCarModel(models["int"], 0, matrices);
	// steeringWHeel 
	renderSteeringWheel(ctx, state, train, matrices);
	// door front
	renderDoorWithChild(matrices, ctx, null, models["doorFR"], models["door_m_ff"], models["doorFRint"], null, models["doorFRgl"], 65 * smoothCubic(doorValue),-150 * smoothCubic(doorValue), 1.21261, 5.33954, 1.21259, 5.1157, 0);//0.178751 0.025
	renderDoorWithChild(matrices, ctx, null, models["doorFL"], models["door_m_fb"], models["doorFLint"], null, models["doorFLgl"], -65 * smoothCubic(doorValue), 150 * smoothCubic(doorValue), 1.21261, 4.19477, 1.21259, 4.4196, 0);
	// door back
	renderDoorWithChild(matrices, ctx, null, models["doorBR"], models["door_m_bf"], models["doorBRint"], null, models["doorBRgl"], 65 * smoothCubic(doorValue),-150 * smoothCubic(doorValue), 1.21261, 0.71432, 1.21259, 0.4067, 0);//-0.240233 0.03
	renderDoorWithChild(matrices, ctx, null, models["doorBL"], models["door_m_bb"], models["doorBLint"], null, models["doorBLgl"], -65 * smoothCubic(doorValue), 150 * smoothCubic(doorValue), 1.21261, -0.689054, 1.21259, -0.3917, 0);

	// windows
	renderTranslucent(ctx, state, train, matrices);
	// lights
	renderLights(ctx, state, train, matrices);
	renderBreakLights(ctx, state, train, matrices);
	renderTurnLights(ctx, state, train, matrices);
	renderReverse(ctx, state, train, matrices);

	

	matrices.popPose();
}

function renderSteeringWheel(ctx, state, train, matrices) {
	let steeringAngle = state.steeringAngle * 6;
	matrices.pushPose();
	// matrices.translate(0.8087, -1.5974, -4.975);
	// matrices.rotate(0, 0.774312, -0.632804, steeringAngle);
	// matrices.translate(-0.8087, 1.5974, 4.975);

	ctx.drawCarModel(models["turnwheel"], 0, matrices);

	matrices.popPose();
	// 0.7528 4.848
}

function renderReverse(ctx, state, train, matrices) {
	if (train.isReversed()) {
		ctx.drawCarModel(models["reverse"], 0, matrices);
	}
}

function renderBackWheels(ctx, state, train, matrices) {
	const radius = 1.3;
	matrices.pushPose();
	matrices.translate(0, 0.52, -1.95453);
	matrices.rotateX(state.wheelAngle * radius);
	matrices.translate(0, -0.52, 1.95453);

	ctx.drawCarModel(models["wheel"], 0, matrices);

	matrices.popPose();
}

function renderFrontWheels(ctx, state, train, matrices) {
	const radius = 1.3;
	let steeringAngle = state.steeringAngle;
	matrices.pushPose();
	matrices.translate(-0.96, 0.52, 3.324);
	matrices.rotateY(steeringAngle);
	matrices.rotateX(state.wheelAngle * radius);
	matrices.translate(0.96, -0.52, -3.324);

	ctx.drawCarModel(models["fwheelR"], 0, matrices);

	matrices.popPose();

	matrices.pushPose();
	matrices.translate(0.96, 0.52, 3.324);
	matrices.rotateY(steeringAngle);
	matrices.rotateX(state.wheelAngle * radius);
	matrices.translate(-0.96, -0.52, -3.324);

	ctx.drawCarModel(models["fwheelL"], 0, matrices);

	matrices.popPose();
}

function renderDoorWithChild(matrices, ctx, parentDoor, childDoor, parentInt, childInt, parentWindow, childIWindow, firstAngle, secondAngle, x1, z1, x2, z2, i) {
	firstAngle = firstAngle / 180.0 * 3.1415;
	secondAngle = secondAngle / 180.0 * 3.1415;

	matrices.pushPose(); // пушим родительскую матрицу в стек
	matrices.translate(x1, 0.0, z1);
	matrices.rotate(0.0, 1.0, 0.0, firstAngle); // поворот двери. Смотри самый нижний комментарий для пояснения 
	matrices.translate(-x1, 0.0, -z1);	
	{
		matrices.pushPose();	// пуш матрицы дочерней
		matrices.translate(x2, 0.0, z2);
		matrices.rotate(0.0, 1.0, 0.0, secondAngle); // поворот
		matrices.translate(-x2, 0.0, -z2);		
		if (childDoor != null) ctx.drawCarModel(childDoor, i, matrices); // рендер внутренней ширмы либо двери
		if (childInt != null) ctx.drawCarModel(childInt, i, matrices);
		if (childIWindow != null) ctx.drawCarModel(childIWindow, i, matrices);
		matrices.popPose(); // дочерняя матрица лопается
	}
	if (parentDoor != null) ctx.drawCarModel(parentDoor, i, matrices); // рендер крайней ширмы либо механизма двери
	if (parentInt != null) ctx.drawCarModel(parentInt, i, matrices);
	if (parentWindow != null) ctx.drawCarModel(parentWindow, i, matrices);
	matrices.popPose(); // родительская матрица лопается
}