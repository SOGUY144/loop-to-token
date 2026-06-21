# 🎮 PROJECT CONTEXT — Horror Survival Game (Unity 6)

## 👤 ข้อมูลผู้พัฒนา (Personal Context)

**ใคร:**
- นักเรียน ม.6 | เป้าหมาย: สอบเข้ามหาวิทยาลัย
- อ่าน/เขียนอังกฤษได้ระดับพื้นฐาน — ชอบรับข้อมูลเป็นภาษาไทย

**ทักษะ:**
- C# — ระดับกลาง (เขียน script Unity ได้)
- Python — มีพื้นฐาน
- Unity + URP — ใช้งานได้ มีประสบการณ์จริง
- ชอบสร้างเกม + เล่นเกม (เช่น Dance games และอื่นๆ)

**เวลา & สไตล์การทำงาน:**
- ปกติ: 20 นาที – 1 ชั่วโมง/วัน
- ถ้า "อิน" มาก: ทำได้ทั้งคืนไม่มีปัญหา
- Mood-driven — ถ้ามีอารมณ์ทำ จะโฟกัสได้สูงมาก

**ข้อจำกัด (สำคัญมาก):**
- ไม่ชอบทำอะไรซ้ำ — ถ้า AI ทำผิดแล้วต้องมาแก้ซ้ำ = หงุดหงิด
- ไม่ชอบอ่านคำอธิบายยาว — ต้องการคำตอบสั้น ตรงประเด็น
- ต้องการให้จบภายในรอบเดียว — ไม่ต้องมาแก้รอบสอง

**เป้าหมายของโปรเจค:**
- ทำเกม horror FPS ให้สำเร็จ เล่นได้จริง ออกมาดีที่สุด
- ใช้เป็น portfolio สำหรับสมัครมหาวิทยาลัย / แสดงความสามารถ

---

## เกม: ชื่อยังไม่ตั้ง (Horror Survival FPS)
**Engine:** Unity 6 (6000.0.73f1) | **Pipeline:** URP | **Platform:** PC

**แนวเกม:** First-Person Horror Survival  
**แรงบันดาลใจ:** Alien: Isolation  
**เนื้อเรื่อง:** AI ที่ฉลาดมากวางแผนครองโลก — ผู้เล่นต้องหนีและเอาตัวรอด

---

## PLAYER SYSTEMS

### Movement (FirstPersonMovement.cs)
- Rigidbody-based FPS (ไม่ใช่ CharacterController)
- Walk 5 m/s | Run 9 m/s | Sneak 2 m/s (LeftCtrl)
- SmoothDamp movement
- Speed override system (List<Func<float>>)

### Camera (FirstPersonLook.cs)
- Mouse sensitivity + smoothing
- Cursor locked

### Crouch (CrouchSystem.cs)
- LeftCtrl กด/ค้าง = ย่อตัว
- ลด camera height + collider height
- Ceiling check ก่อนลุก
- ย่อตัว = เงียบ (ไม่มีเสียงฝีเท้า)

### Weapon (Flashlight.cs = FlashlightGun)
- ยิงเป็น laser/light beam
- มี Battery % — ยิงแล้วแบตหมด
- ยิง Enemy โดยตรง = ไม่มีผล (damage < threshold)
- ยิง GasTank = ระเบิด
- ส่องหน้า Enemy = Flinch 1.5 วิ
- `LightOn` property — เปิดไฟ = Enemy มองเห็นไกลขึ้น +10m

### Object Interaction (ObjectGrabber.cs)
- Q = หยิบ | Mouse1 = โยน | Drop = วางเงียบ
- โยนกระแทก = NoisyObject → Enemy ได้ยิน
- ยิ่งโยนบ่อย Enemy เริ่มไม่สนใจ (AdaptiveLearning)

### Player Health (PlayerHealth.cs)
- maxHP = 100 | ไม่มี HP bar บนจอ
- โดนตี → hit flash แดง (post processing)
- HP ต่ำ → desaturate + chromatic aberration
- ตาย → Timeline cutscene → fade → respawn
- Implement IDamageable

### HUD (GUICrosshairHUD.cs)
- Crosshair เท่านั้น — ไม่มี HP bar, BAT bar, CHARGES
- Stamina ทำงานอยู่ (อ่านค่าผ่าน GetStaminaPercent())

### Other Player Systems
- **PlayerInteract.cs** — กด E = interact (IInteractable interface)
- **PlayerFootstepNoise.cs** — วิ่ง = เสียงดัง (loudness 6), เดิน = เบา (2.5), ย่อ = เงียบ
- **StaminaEffects.cs** — stamina ต่ำ = หอบ → Enemy ได้ยิน | Enemy ใกล้ < 8m = Adrenaline x1.3 speed
- **MotionTracker.cs** — กด Tab = เรดาร์สีเขียว แสดงจุดแดง Enemy, beep ถี่ตามระยะ
- **MenaceSystem.cs** — Enemy ใกล้ = vignette + heartbeat + screen shake (ส่งค่าให้ GamePostProcess)

---

## POST PROCESSING (GamePostProcess.cs)
- แนบบน Player | ลาก VolumeProfile Asset ใส่
- Vignette: menace (แดง) + damage (สว่าง) + low HP (มืด)
- Chromatic Aberration: ตอนโดนตี + HP ต่ำ
- Color Desaturate: HP < 30%
- Film Grain: เพิ่มตาม menace level

---

## ENEMY SYSTEM — XenomorphAI

### Files (ทั้ง 4 อยู่ใน Scripts/Enemy/)
- **IXenomorphState.cs** — interface (ไม่ใช่ MonoBehaviour)
- **XenomorphSenses.cs** — vision + hearing + memory
- **XenomorphAnimator.cs** — animator bridge + IK + tail physics
- **XenomorphAI.cs** — main FSM

### Enemy Stats
- HP: 200 | Chase speed: 8.5 m/s | Patrol: 2.5 | Stalk: 1.2
- Attack damage: 35 | Attack range: 2m | Cooldown: 1.2s
- Damage threshold: 30 (กระสุน ≈ 10 = ไม่เจ็บ, ระเบิด ≈ 80 = เจ็บ)

### Senses
- Vision FOV: 90° | Range: 20m | Dark penalty: 40%
- Flashlight bonus: +10m เมื่อ player เปิดไฟ
- Hearing: 18m radius | Memory: 20 วิ
- Raycast ไม่ชน collider ตัวเอง (RaycastAll + filter)
- HideZone = CanSeePlayer = false

### States (FSM)
```
Patrol → [เห็น] Chase
       → [วิ่ง ด้านหลัง] Chase ทันที!
       → [เดิน ด้านหลัง] Investigate
       → [Director hint] Investigate

Investigate → วนเวียนรอบๆ สไตล์ผี (ไม่เดินตรงหา)
           → [เห็น/เสียงดัง] Chase

Chase → [ไม่เห็น 3วิ] Search
     → [ใกล้พอ] Attack

Attack → [ออกไกล] Chase

Search → [เห็น] Chase | [เสียง] Investigate | [20วิ] Patrol
```

### Rotation System
- `agent.updateRotation = false` — หมุนเองด้วย Slerp
- Chase/Attack = หันหา Player | Patrol = หันตาม velocity | Idle = แช่แข็ง

### Animation
- Animator Controller: Idle State / Walk / Run (ไม่มี transition!)
- CrossFadeInFixedTime สั่งตรง: Patrol=Walk, Chase=Run, Idle=Idle State
- applyRootMotion = false

### Environment Interaction
- `TryInteractDoor()` — เปิดประตูธรรมดา / พังประตูล็อก (IDoor interface)
- `TryCheckLockers()` — เว้นไว้ hook กับ HideZone ทีหลัง
- `Flinch(duration)` — สะดุ้งถอยหลัง (จากไฟฉาย หรือระเบิด)

---

## DIRECTOR + ADAPTIVE SYSTEMS

### DirectorAI.cs (บน Empty "GameDirector")
- รู้ว่า Player อยู่ไหนตลอด
- Tension 0→1 เพิ่มเมื่อ Player ปลอดภัยนาน
- Hint: ส่งตำแหน่ง Player (คลาดเคลื่อนตาม tension) ให้ Enemy
- Relief: หลังหนีรอด → Enemy ถอย 12 วิ

### AdaptiveLearning.cs (บน Enemy)
- จำว่า Player ซ่อนที่ไหนบ่อย → ไปเช็คที่นั่นก่อน
- โยนของล่อบ่อย → DistractionInterest ลดลง → ได้ยินเสียงน้อยลง

---

## ENVIRONMENT SYSTEMS

### HideZone.cs
- แนบบน Cube + BoxCollider (Is Trigger) ใต้โต๊ะ
- LeftCtrl + อยู่ในโซน = ซ่อน = Enemy มองไม่เห็น
- Static `IsPlayerHiddenAnywhere` — ให้ระบบอื่นอ่าน
- แจ้ง AdaptiveLearning เมื่อซ่อน

### SimpleDoor.cs (implement IDoor + IInteractable)
- E = เปิด/ปิด | ล็อก = ปิดไม่ได้
- Enemy: ประตูปิด = เปิดเอง, ล็อก = พัง (เสียงดัง 10)
- `Unlock()` สำหรับระบบ puzzle

### GasTank.cs (implement IDamageable)
- ยิงโดน HP หมด → กระพริบแดง 1.2วิ → ระเบิด
- Explosion: damage 80 + AddExplosionForce + Chain explosion
- Enemy โดนระเบิด: TakeDamage(80) > threshold → เจ็บ + Flinch 2วิ

### NoisyObject.cs
- แนบอัตโนมัติตอน ObjectGrabber โยน/วาง
- กระแทก → ReportNoise ตามแรง
- DistractionInterest ลดตามความถี่โยน

### MimicObject.cs + MimicEnemy.cs
- ของที่ซ่อนตัวเป็น enemy
- เข้าใกล้/กด E → absorb animation → spawn enemy

---

## INTERFACES (ทำงานข้าม script)
```csharp
IDamageable  — TakeDamage(float)           // PlayerHealth, XenomorphAI, GasTank
IInteractable — CanInteract(), GetPrompt(), Interact()  // HideZone, SimpleDoor, MimicObject
IDoor        — IsLocked, Open(), BreakDown()  // SimpleDoor
```

---

## SETUP CHECKLIST (Enemy GameObject)
```
Enemy Variant (Tag: Enemy, Layer: Enemy)
├── NavMeshAgent (Humanoid, autoBraking=false)
├── Rigidbody
├── Capsule Collider (Is Trigger: OFF)
├── Audio Source
├── XenomorphSenses ← ลาก EyePoint ใส่
├── XenomorphAnimator ← auto-find Animator
├── XenomorphAI ← ลาก PatrolPoints ใส่
└── AdaptiveLearning

Scene:
├── GameDirector (Empty) ← DirectorAI.cs + ลาก Enemy
└── Global Volume ← Vignette + Chromatic + Color Adj + Film Grain

Player (First Person Controller):
├── CrouchSystem ← ลาก targets (Camera, Flashlight)
├── PlayerFootstepNoise
├── StaminaEffects
├── MotionTracker
├── MenaceSystem
└── GamePostProcess ← ลาก VolumeProfile asset
```

---

## RULES สำหรับ AI Dev Partner
1. **ตอบสั้น** — ไม่อธิบายยาว ถ้าไม่ถาม
2. **โค้ดก่อนเสมอ** — ถ้าแก้ได้ด้วยโค้ด ทำเลย
3. **ถามเมื่อไม่แน่ใจ** — อย่า assume
4. **Unity 6 + URP** — ใช้ API ถูก version
5. **ภาษาไทย** — คุยเป็นภาษาไทยตลอด
6. **อย่าแตะไฟล์ที่ไม่เกี่ยว** — แก้เฉพาะที่บอก
7. **ไม่มี StunnableEnemy, PrometheusAI** — ถูกลบออกแล้ว
8. **Volume API**: ใช้ `VolumeProfile` ตรงๆ ไม่ใช่ `volume.profile`
