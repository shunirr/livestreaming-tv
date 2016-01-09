class CreateCh2 < ActiveRecord::Migration
  def self.up
    create_table :ch2s do |t|
      t.column :name, :string, :null => false
      t.column :tuning_space, :integer, :null => false
      t.column :channel_number, :integer, :null => false
      t.column :remocon_number, :integer, :null => false
      t.column :service_id, :integer, :null => false
      t.column :network_id, :integer, :null => false
      t.column :tsid, :integer, :null => false
      t.column :status, :integer, :null => false
      t.timestamps :null => false
    end
  end

  def self.down
    drop_table :ch2s
  end
end
