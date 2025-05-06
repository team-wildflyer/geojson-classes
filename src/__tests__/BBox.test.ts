import { BBox } from '../BBox'

describe("BBox", () => {

  describe("construction", () => {
    
    it("should allow creating a bbox with four coordinates", () => {
      const bbox = new BBox([-10, -20, 10, 20])
      expect(bbox.lon1).toBe(-10)
      expect(bbox.lat1).toBe(-20)
      expect(bbox.lon2).toBe(10)
      expect(bbox.lat2).toBe(20)
    })

    it("should not allow specifying latitudes in a non-increasing order", () => {
      expect(() => new BBox([-10, 20, 10, -20])).toThrow()
    })

    it("should however allow specifying longitudes in a non-increasing order", () => {
      const bbox = new BBox([10, -20, -10, 20])
      expect(bbox.lon1).toBe(10)
      expect(bbox.lat1).toBe(-20)
      expect(bbox.lon2).toBe(-10)
      expect(bbox.lat2).toBe(20)
    })
  
  })

  // describe("around", () => {})

  describe("world", () => {
    
    it("should create a world bbox (excluding the poles, which are typically excluded)", () => {
      const bbox = BBox.world()
      expect(bbox.bbox).toEqual([-180, -85.0511287798066, 180, 85.0511287798066])
    })

    it("should allow overriding the latitude extent", () => {
      const bbox = BBox.world(80)
      expect(bbox.bbox).toEqual([-180, -80, 180, 80])
    })
  
  })

  describe("overlaps", () => {

    let base: BBox

    test("latitude check", () => {
      const base = new BBox([-100, -10, 100, 10])

      // Case 1: bbox is completely inside base
      expect(base.overlaps(new BBox([-10, -5, 10, 5]))).toBe(true)
      // Case 2: base is completely inside bbox
      expect(base.overlaps(new BBox([-10, -15, 10, 15]))).toBe(true)
      // Case 3: bbox is fully outside base
      expect(base.overlaps(new BBox([-10, -20, 10, -15]))).toBe(false)
      expect(base.overlaps(new BBox([-10, 15, 10, 20]))).toBe(false)
      // Case 4: bbox abuts base
      expect(base.overlaps(new BBox([-10, -20, 10, -10]))).toBe(true)
      expect(base.overlaps(new BBox([-10, 10, 10, 20]))).toBe(true)
      // Case 5: bbox overlaps base partially
      expect(base.overlaps(new BBox([-10, -20, 10, 0]))).toBe(true)
      expect(base.overlaps(new BBox([-10, 0, 10, 20]))).toBe(true)
    })

    describe("longitude check with a bbox that does not wrap around the date line", () => {

      beforeEach(() => { base = new BBox([-100, -90, 100, 90]) })

      it("should correctly determine whether a non-wrapping bbox overlaps", () => {
        // Case 1: bbox is completely inside base
        expect(base.overlaps(new BBox([-90, -10, 90, 10]))).toBe(true)
        // Case 2: base is completely inside bbox
        expect(base.overlaps(new BBox([-110, -10, 110, 10]))).toBe(true)
        // Case 3: bbox is fully outside base
        expect(base.overlaps(new BBox([-110, -10, -105, 10]))).toBe(false)
        expect(base.overlaps(new BBox([105, -10, 110, 10]))).toBe(false)
        // Case 4: bbox abuts base
        expect(base.overlaps(new BBox([-110, -10, -100, 10]))).toBe(true)
        expect(base.overlaps(new BBox([100, -10, 110, 10]))).toBe(true)
        // Case 5: bbox overlaps base partially
        expect(base.overlaps(new BBox([-110, -10, -90, 10]))).toBe(true)
        expect(base.overlaps(new BBox([90, -10, 110, 10]))).toBe(true)
      })

      it("should correctly determine whether a wrapping bbox overlaps", () => {
        // Case 1: bbox starts and ends in base
        expect(base.overlaps(new BBox([90, -10, -90, 10]))).toBe(true)
        // Case 2: base is completely inside bbox
        expect(base.overlaps(new BBox([-150, -10, 150, 10]))).toBe(true)
        // Case 3: bbox is fully outside base
        expect(base.overlaps(new BBox([150, -10, 155, 10]))).toBe(false)
        // Case 4: bbox abuts base
        expect(base.overlaps(new BBox([150, -10, -100, 10]))).toBe(true)
        expect(base.overlaps(new BBox([100, -10, -150, 10]))).toBe(true)
        // Case 5: bbox overlaps base
        expect(base.overlaps(new BBox([150, -10, -90, 10]))).toBe(true)
        expect(base.overlaps(new BBox([90, -10, -150, 10]))).toBe(true)
      })

    })

    describe("longitude check with a bbox that wraps around the date line", () => {

      beforeEach(() => { base = new BBox([160, -90, -160, 90]) })

      it("should correctly determine whether a non-wrapping bbox overlaps", () => {
        // Case 1: bbox is completely inside base
        expect(base.overlaps(new BBox([170, -10, 175, 10]))).toBe(true)
        // Case 2: base is completely inside bbox is not possible here because then the bbox would wrap
        // Case 3: bbox is fully outside base
        expect(base.overlaps(new BBox([150, -10, 155, 10]))).toBe(false)
        // Case 4: bbox abuts base
        expect(base.overlaps(new BBox([150, -10, 160, 10]))).toBe(true)
        expect(base.overlaps(new BBox([-160, -10, -150, 10]))).toBe(true)
        // Case 5: bbox overlaps base
        expect(base.overlaps(new BBox([-170, -10, -150, 10]))).toBe(true)
        expect(base.overlaps(new BBox([150, -10, 170, 10]))).toBe(true)
      })

      it("should correctly determine whether a wrapping bbox overlaps", () => {
        // Note: they always overlap, namely at the date line. But test all cases.
        // Case 1: bbox is completely inside base
        expect(base.overlaps(new BBox([170, -10, -170, 10]))).toBe(true)
        // Case 2: base is completely inside bbox
        expect(base.overlaps(new BBox([150, -10, -150, 10]))).toBe(true)
        // Case 2: bbox is fully outside base is not possible here
        // Case 3: bbox abuts base (use another base here)
        expect(new BBox([170, -10, 180, -10]).overlaps(new BBox([-180, -10, -170, 10]))).toBe(true)
        expect(new BBox([-180, -10, -170, -10]).overlaps(new BBox([170, -10, 180, 10]))).toBe(true)
        // Case 4: bbox overlaps base
        expect(base.overlaps(new BBox([150, -10, -170, 10]))).toBe(true)
        expect(base.overlaps(new BBox([170, -10, -150, 10]))).toBe(true)
      })

    })

  })

  describe("intersect", () => {

    let base: BBox

    test("latitude intersection", () => {
      const base = new BBox([-100, -10, 100, 10])

      // Case 1: bbox is completely inside base
      expect(base.intersect(new BBox([-10, -5, 10, 5]))).toEqual([new BBox([-10, -5, 10, 5])])
      // Case 2: base is completely inside bbox
      expect(base.intersect(new BBox([-10, -15, 10, 15]))).toEqual([new BBox([-10, -10, 10, 10])])
      // Case 3: bbox is fully outside base
      expect(base.intersect(new BBox([-10, -20, 10, -15]))).toEqual([])
      expect(base.intersect(new BBox([-10, 15, 10, 20]))).toEqual([])
      // Case 4: bbox abuts base
      expect(base.intersect(new BBox([-10, -20, 10, -10]))).toEqual([new BBox([-10, -10, 10, -10])])
      expect(base.intersect(new BBox([-10, 10, 10, 20]))).toEqual([new BBox([-10, 10, 10, 10])])
      // Case 5: bbox overlaps base partially
      expect(base.intersect(new BBox([-10, -20, 10, 0]))).toEqual([new BBox([-10, -10, 10, 0])])
      expect(base.intersect(new BBox([-10, 0, 10, 20]))).toEqual([new BBox([-10, 0, 10, 10])])
    })

    describe("longitude intersection with a non-wrapping base", () => {

      beforeEach(() => { base = new BBox([-100, -90, 100, 90]) })

      it("should correctly intersect with a non-wrapping bbox", () => {
        // Case 1: bbox is completely inside base
        expect(base.intersect(new BBox([-90, -10, 90, 10]))).toEqual([new BBox([-90, -10, 90, 10])])
        // Case 2: base is completely inside bbox
        expect(base.intersect(new BBox([-110, -10, 110, 10]))).toEqual([new BBox([-100, -10, 100, 10])])
        // Case 3: bbox is fully outside base
        expect(base.intersect(new BBox([-110, -10, -105, 10]))).toEqual([])
        expect(base.intersect(new BBox([105, -10, 110, 10]))).toEqual([])
        // Case 4: bbox abuts base
        expect(base.intersect(new BBox([-110, -10, -100, 10]))).toEqual([new BBox([-100, -10, -100, 10])])
        expect(base.intersect(new BBox([100, -10, 110, 10]))).toEqual([new BBox([100, -10, 100, 10])])
        // Case 5: bbox overlaps base partially
        expect(base.intersect(new BBox([-110, -10, -90, 10]))).toEqual([new BBox([-100, -10, -90, 10])])
        expect(base.intersect(new BBox([90, -10, 110, 10]))).toEqual([new BBox([90, -10, 100, 10])])
      })

      it("should intersect with a wrapping bbox", () => {
        // Case 1: bbox starts and ends in base
        expect(base.intersect(new BBox([90, -10, -90, 10]))).toEqual([
          new BBox([-100, -10, -90, 10]),
          new BBox([90, -10, 100, 10]),
        ])
        // Case 2: base is completely inside bbox is not possible here
        // Case 3: bbox is fully outside base
        expect(base.intersect(new BBox([150, -10, 155, 10]))).toEqual([])
        // Case 4: bbox abuts base
        expect(base.intersect(new BBox([150, -10, -100, 10]))).toEqual([new BBox([-100, -10, -100, 10])])
        expect(base.intersect(new BBox([100, -10, -150, 10]))).toEqual([new BBox([100, -10, 100, 10])])
        // Case 5: bbox overlaps base
        expect(base.intersect(new BBox([150, -10, -90, 10]))).toEqual([new BBox([-100, -10, -90, 10])])
        expect(base.intersect(new BBox([90, -10, -150, 10]))).toEqual([new BBox([90, -10, 100, 10])])
      })

    })

    describe("longitude intersection with a wrapping base", () => {

      beforeEach(() => { base = new BBox([160, -90, -160, 90]) })

      it("should intersect with a non-wrapping bbox", () => {
        // Case 1: bbox is completely inside base
        expect(base.intersect(new BBox([170, -10, 175, 10]))).toEqual([new BBox([170, -10, 175, 10])])
        // Case 2: base is completely inside bbox is not possible here
        // Case 3: bbox is fully outside base
        expect(base.intersect(new BBox([150, -10, 155, 10]))).toEqual([])
        // Case 4: bbox abuts base
        expect(base.intersect(new BBox([150, -10, 160, 10]))).toEqual([new BBox([160, -10, 160, 10])])
        expect(base.intersect(new BBox([-160, -10, -150, 10]))).toEqual([new BBox([-160, -10, -160, 10])])
        // Case 5: bbox overlaps base
        expect(base.intersect(new BBox([-170, -10, -150, 10]))).toEqual([new BBox([-170, -10, -160, 10])])
        expect(base.intersect(new BBox([150, -10, 170, 10]))).toEqual([new BBox([160, -10, 170, 10])])
      })

      it("should intersect with a wrapping bbox", () => {
        // Case 1: bbox is completely inside base
        expect(base.intersect(new BBox([170, -10, -170, 10]))).toEqual([
          new BBox([170, -10, -170, 10]),
        ])
        // Case 2: base is completely inside bbox
        expect(base.intersect(new BBox([150, -10, -150, 10]))).toEqual([
          new BBox([160, -10, -160, 10]),
        ])
        // Case 2: bbox is fully outside base is not possible here
        // Case 3: bbox abuts base (use another base here)
        expect(new BBox([170, -10, 180, 10]).intersect(new BBox([-180, -10, -170, 10]))).toEqual([
          new BBox([180, -10, 180, 10]),
        ])
        expect(new BBox([-180, -10, -170, 10]).intersect(new BBox([170, -10, 180, 10]))).toEqual([
          new BBox([180, -10, 180, 10]),
        ])
        // Case 4: bbox overlaps base
        expect(base.intersect(new BBox([150, -10, -170, 10]))).toEqual([
          new BBox([160, -10, -170, 10]),
        ])
        expect(base.intersect(new BBox([170, -10, -150, 10]))).toEqual([
          new BBox([170, -10, -160, 10]),
        ])
      })

    })

  })

})