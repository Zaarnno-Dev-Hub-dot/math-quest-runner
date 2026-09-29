extends CharacterBody2D

const SPEED = 200.0
const JUMP_VELOCITY = -350.0
const DOUBLE_JUMP_VELOCITY = -300.0

# Get the gravity from the project settings to be synced with RigidBody nodes.
var gravity = ProjectSettings.get_setting("physics/2d/default_gravity")

var has_double_jump = false
var _jump_was_down = false

func _physics_process(delta):
	# Add gravity
	if not is_on_floor():
		velocity.y += gravity * delta

	# Handle jump (edge-detect the key: Godot 4 has no Input.is_key_just_pressed).
	var jump_down = Input.is_key_pressed(KEY_SPACE)
	var jump_pressed = jump_down and not _jump_was_down
	_jump_was_down = jump_down
	if jump_pressed:
		if is_on_floor():
			velocity.y = JUMP_VELOCITY
			has_double_jump = true
		elif has_double_jump:
			velocity.y = DOUBLE_JUMP_VELOCITY
			has_double_jump = false

	# Get the input direction.
	var direction = 0
	if Input.is_key_pressed(KEY_A):
		direction = -1
	elif Input.is_key_pressed(KEY_D):
		direction = 1

	if direction != 0:
		velocity.x = direction * SPEED
	else:
		velocity.x = move_toward(velocity.x, 0, SPEED)

	move_and_slide()
