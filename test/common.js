
const assert = require('assert');
const chai = require('chai');

const common = require('../api/common');

describe("common", function() {
    it('intersect_scopes', function(done) {
        var s1 = {
            "a": [ "1", "2", "3" ], 
            "b": [ "1", "2", "3" ], 
            "c": [ "4" ], 
            "d": [ ], 
        }  
        var s2 = {
            "b": [ "2", "5" ],
            "d": [ "4" ],
        }
        var ans =  {
            "b": [ "2" ],
            "d": [ ],
        }
        var inter = common.intersect_scopes(s1, s2);
        chai.expect(inter).to.deep.equal(ans);
        //reverse should be the same
        inter = common.intersect_scopes(s2, s1);
        chai.expect(inter).to.deep.equal(ans);
        done();
    });

    it('intersect_scopes(one side empty)', function(done) {
        var s1 = {
            "a": [ "1", "2", "3" ], 
            "b": [ "1", "2", "3" ], 
            "c": [ "4" ], 
            "d": [ ], 
        }  
        var s2 = {
        }
        var inter = common.intersect_scopes(s1, s2);
        chai.expect(inter).to.deep.equal({});
        //reverse should be the same
        inter = common.intersect_scopes(s2, s1);
        chai.expect(inter).to.deep.equal({});
        done();
    });
    it('intersect_scopes(body empty)', function(done) {
        var s1 = {}  
        var s2 = {}
        var inter = common.intersect_scopes(s1, s2);
        chai.expect(inter).to.deep.equal({});
        done();
    });
});


