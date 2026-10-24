# biopulse_anatomy.glb  (units: metres, Y-up, +Z faces front, body's left = +X)

Node hierarchy (names to look up with scene.getObjectByName):
- body_skin            whole-body skin shell (use fresnel hologram shader)
- ribcage              24 ribs + costal cartilages + sternum
- spine                cervical/thoracic/lumbar vertebrae
- diaphragm
- trachea
- heart_pivot          (empty node at the heart APEX; scale/animate THIS node)
    - heart_muscle     ventricles + atria walls
    - heart_vessels    aorta, pulmonary trunk/arteries/veins, SVC
- lung_left_pivot      (empty node at lung APEX; scale THIS node for breathing)
    - lung_left_surface, bronchi_left
- lung_right_pivot
    - lung_right_surface, bronchi_right

Pivots (world position of the pivot nodes): see pivots.json.
Real sizes: torso ~0.5 m wide, each lung ~0.27 m tall, heart ~0.11 m tall.
Skin spans y 0..1.72 m; the chest is at y ~ 1.1-1.45 m.
Mesh vertices of pivoted groups are stored relative to their pivot, so scaling the
pivot node expands the organ from its apex without any translation.
Total ~6.6 MB, ~250k triangles.
