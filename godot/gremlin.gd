extends CharacterBody2D

const SPEED = 80.0
var direction = 1.0

func _physics_process(delta):
	velocity.x = direction * SPEED
	move_and_slide()
	
	if is_on_wall() or not $RayCast2D.is_colliding():
		direction *= -1
